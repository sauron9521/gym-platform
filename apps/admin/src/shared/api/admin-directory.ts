import { getAdminApiOrigin } from './upstream.mjs';

const PAGE_LIMIT = 20;
const MAX_PAGE = 10_000;
const roles = ['ATHLETE', 'TRAINER', 'ADMIN'] as const;
type Role = (typeof roles)[number];

export type DirectoryFilters = { page: number; search: string; role: Role | '' };
export type DirectoryRow = {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE';
  createdAt: string;
};
export type DirectoryMeta = {
  total: number;
  skip: number;
  take: number;
  totalPages: number;
};
export type DirectoryResult =
  | { kind: 'ready'; data: DirectoryRow[]; meta: DirectoryMeta }
  | { kind: 'forbidden' | 'unavailable' | 'unauthenticated' | 'invalid' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Only filters supported by the privileged API are accepted. */
export function parseDirectoryFilters(
  params: SearchParams,
): { kind: 'valid'; filters: DirectoryFilters } | { kind: 'invalid' } {
  if (Object.keys(params).some((key) => !['page', 'search', 'role'].includes(key))) {
    return { kind: 'invalid' };
  }
  const rawPage = params.page ?? '1';
  const rawSearch = params.search ?? '';
  const rawRole = params.role ?? '';
  if (
    typeof rawPage !== 'string' ||
    typeof rawSearch !== 'string' ||
    typeof rawRole !== 'string' ||
    !/^[1-9][0-9]{0,4}$/.test(rawPage)
  ) {
    return { kind: 'invalid' };
  }

  const page = Number(rawPage);
  const search = rawSearch.trim();
  if (
    page > MAX_PAGE ||
    (search.length > 0 && (search.length < 2 || search.length > 100)) ||
    (rawRole !== '' && !roles.some((role) => role === rawRole))
  ) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', filters: { page, search, role: rawRole as Role | '' } };
}

export function directoryPageHref(filters: DirectoryFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.role) params.set('role', filters.role);
  if (page !== 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/users?${query}` : '/users';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

/**
 * Whitelist the upstream shape so future API changes cannot leak extra PII
 * to HTML. A corrupt, incomplete or untrusted response fails closed.
 */
function parseDirectoryResponse(payload: unknown, filters: DirectoryFilters): DirectoryResult {
  if (!isPlainRecord(payload) || !hasExactKeys(payload, ['data', 'meta'])) {
    return { kind: 'unavailable' };
  }
  if (!Array.isArray(payload.data) || payload.data.length > PAGE_LIMIT) {
    return { kind: 'unavailable' };
  }
  const meta = payload.meta;
  if (!isPlainRecord(meta) || !hasExactKeys(meta, ['total', 'skip', 'take', 'totalPages'])) {
    return { kind: 'unavailable' };
  }
  const expectedSkip = (filters.page - 1) * PAGE_LIMIT;
  if (
    !Number.isSafeInteger(meta.total) ||
    (meta.total as number) < 0 ||
    meta.skip !== expectedSkip ||
    meta.take !== PAGE_LIMIT ||
    meta.totalPages !== Math.ceil((meta.total as number) / PAGE_LIMIT)
  ) {
    return { kind: 'unavailable' };
  }

  const data: DirectoryRow[] = [];
  for (const user of payload.data) {
    if (
      !isPlainRecord(user) ||
      !hasExactKeys(user, ['id', 'email', 'role', 'status', 'createdAt']) ||
      typeof user.id !== 'string' ||
      !/^[0-9a-fA-F-]{36}$/.test(user.id) ||
      typeof user.email !== 'string' ||
      !user.email.includes('@') ||
      user.email.length > 320 ||
      !roles.some((role) => role === user.role) ||
      user.status !== 'ACTIVE' ||
      typeof user.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(user.createdAt))
    ) {
      return { kind: 'unavailable' };
    }
    data.push({
      id: user.id,
      email: user.email,
      role: user.role as Role,
      status: 'ACTIVE',
      createdAt: user.createdAt,
    });
  }
  return {
    kind: 'ready',
    data,
    meta: {
      total: meta.total as number,
      skip: expectedSkip,
      take: PAGE_LIMIT,
      totalPages: meta.totalPages as number,
    },
  };
}

/** Only call AFTER readAdminSession succeeds on the Next.js server. */
export async function readAdminDirectory(
  cookieHeader: string,
  filters: DirectoryFilters,
  configured = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<DirectoryResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!configured?.trim()) return { kind: 'unavailable' };

  try {
    const origin = getAdminApiOrigin(configured);
    const query = new URLSearchParams({ page: String(filters.page), limit: String(PAGE_LIMIT) });
    if (filters.search) query.set('search', filters.search);
    if (filters.role) query.set('role', filters.role);
    const response = await send(origin + '/admin/users?' + query.toString(), {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status !== 200) return { kind: 'unavailable' };

    return parseDirectoryResponse(await response.json(), filters);
  } catch {
    // No upstream URL, request details, cookie or body is ever rendered/logged.
    return { kind: 'unavailable' };
  }
}
