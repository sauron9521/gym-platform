import { createTrainerServerApiClient } from './trainer-server-api';

const CLIENTS_PER_PAGE = 8;
const MAX_CLIENT_PAGE = 10_000;

export type TrainerClientsResult =
  | {
      kind: 'ready';
      clients: { id: string; email: string }[];
      page: number;
      total: number;
      totalPages: number;
    }
  | { kind: 'unauthenticated' | 'forbidden' | 'unavailable' };

/** Strict and bounded server input; never interpolate arbitrary query strings. */
export function parseTrainerClientsPage(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,4}$/.test(value)) return 1;
  const page = Number(value);
  return page <= MAX_CLIENT_PAGE ? page : 1;
}

/**
 * Queries only active, trainer-owned relationships. API scope must filter
 * BEFORE PostgreSQL LIMIT/OFFSET/COUNT: a dual-capability user may also be
 * somebody else's athlete. No SSR user-supplied origins or credentials.
 */
export async function loadTrainerClients(
  cookieHeader: string,
  page: number,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerClientsResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_CLIENT_PAGE) {
    return { kind: 'unavailable' };
  }

  try {
    const api = createTrainerServerApiClient(cookieHeader, configuredOrigin, send);
    const response = await api.GET('/trainer-athletes', {
      params: { query: { page, limit: CLIENTS_PER_PAGE, status: 'ACTIVE', scope: 'trainer' } },
    });

    if (response.response.status === 401) return { kind: 'unauthenticated' };
    if (response.response.status === 403) return { kind: 'forbidden' };
    if (response.response.status !== 200 || !response.data) return { kind: 'unavailable' };

    const { data, meta } = response.data;
    if (
      !Array.isArray(data) ||
      data.length > CLIENTS_PER_PAGE ||
      !meta ||
      !Number.isSafeInteger(meta.total) ||
      meta.total < 0 ||
      !Number.isSafeInteger(meta.totalPages) ||
      meta.totalPages < 0 ||
      !Number.isSafeInteger(meta.take) ||
      meta.take !== CLIENTS_PER_PAGE ||
      !Number.isSafeInteger(meta.skip) ||
      meta.skip !== (page - 1) * CLIENTS_PER_PAGE
    ) {
      return { kind: 'unavailable' };
    }

    const clients: { id: string; email: string }[] = [];
    for (const item of data) {
      if (
        item.status !== 'ACTIVE' ||
        typeof item.id !== 'string' ||
        typeof item.trainerId !== 'string' ||
        !item.athlete ||
        !('email' in item.athlete) ||
        typeof item.athlete.email !== 'string'
      ) {
        return { kind: 'unavailable' };
      }
      clients.push({ id: item.id, email: item.athlete.email });
    }

    return { kind: 'ready', clients, page, total: meta.total, totalPages: meta.totalPages };
  } catch {
    // API outage, malformed JSON, unexpected redirects and unsafe config never
    // render stale athlete details or expose the upstream/cookie in the UI.
    return { kind: 'unavailable' };
  }
}
