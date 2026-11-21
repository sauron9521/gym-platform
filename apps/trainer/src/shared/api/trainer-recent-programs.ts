import { createTrainerServerApiClient } from './trainer-server-api';

const PREVIEW_LIMIT = 5;
type ProgramStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type TrainerRecentProgramsResult =
  | {
      kind: 'ready';
      programs: { id: string; title: string; status: ProgramStatus }[];
      total: number;
    }
  | { kind: 'unauthenticated' | 'forbidden' | 'unavailable' };

/**
 * Fetch an owner-scoped, bounded preview via the existing Trainer programs API.
 * Program count is NOT the number of active athlete assignments.
 */
export async function loadTrainerRecentPrograms(
  cookieHeader: string,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerRecentProgramsResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };

  try {
    const api = createTrainerServerApiClient(cookieHeader, configuredOrigin, send);
    const response = await api.GET('/training-programs', {
      params: { query: { page: 1, limit: PREVIEW_LIMIT } },
    });
    if (response.response.status === 401) return { kind: 'unauthenticated' };
    if (response.response.status === 403) return { kind: 'forbidden' };
    if (response.response.status !== 200 || !response.data) return { kind: 'unavailable' };

    const { data, meta } = response.data;
    if (
      !Array.isArray(data) ||
      data.length > PREVIEW_LIMIT ||
      !meta ||
      !Number.isSafeInteger(meta.total) ||
      meta.total < 0 ||
      !Number.isSafeInteger(meta.skip) ||
      meta.skip !== 0 ||
      meta.take !== PREVIEW_LIMIT ||
      meta.totalPages !== Math.ceil(meta.total / PREVIEW_LIMIT) ||
      data.length > meta.total
    ) {
      return { kind: 'unavailable' };
    }

    const programs: { id: string; title: string; status: ProgramStatus }[] = [];
    const ids = new Set<string>();
    for (const item of data) {
      const version = item.versions?.[0];
      if (
        typeof item.id !== 'string' ||
        item.id.length === 0 ||
        ids.has(item.id) ||
        !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(item.status) ||
        !Array.isArray(item.versions) ||
        item.versions.length !== 1 ||
        !version ||
        typeof version.title !== 'string' ||
        !version.title.trim()
      ) {
        return { kind: 'unavailable' };
      }
      ids.add(item.id);
      programs.push({ id: item.id, title: version.title, status: item.status });
    }

    return { kind: 'ready', programs, total: meta.total };
  } catch {
    // No leaked credentials or stale private rows after API, transport or JSON errors.
    return { kind: 'unavailable' };
  }
}
