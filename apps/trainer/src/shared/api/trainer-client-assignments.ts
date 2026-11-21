import { createTrainerServerApiClient } from './trainer-server-api';

const ASSIGNMENTS_PER_PAGE = 8;
const MAX_PAGE = 10_000;
const RELATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AssignmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'TERMINATED';

export type TrainerClientAssignmentsResult =
  | {
      kind: 'ready';
      assignments: {
        id: string;
        title: string;
        version: number;
        status: AssignmentStatus;
      }[];
      total: number;
      page: number;
      totalPages: number;
    }
  | { kind: 'unauthenticated' | 'forbidden' | 'not_found' | 'unavailable' };

export function parseClientAssignmentsPage(value: string | readonly string[] | undefined): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,4}$/.test(value)) return 1;
  const page = Number(value);
  return page <= MAX_PAGE ? page : 1;
}

/**
 * Strict, read-only SSR list of assignments for one *currently active*
 * trainer-owned collaboration. API authorization and SQL filtering happen
 * before COUNT/LIMIT/OFFSET; no personal athlete workout list is read here.
 */
export async function loadTrainerClientAssignments(
  cookieHeader: string,
  relationId: string,
  page: number,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerClientAssignmentsResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!RELATION_ID_RE.test(relationId)) return { kind: 'not_found' };
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
    return { kind: 'unavailable' };
  }

  try {
    const api = createTrainerServerApiClient(cookieHeader, configuredOrigin, send);
    const response = await api.GET('/training-programs/assignments', {
      params: {
        query: {
          trainerAthleteId: relationId,
          page,
          limit: ASSIGNMENTS_PER_PAGE,
          view: 'summary',
        },
      },
    });

    if (response.response.status === 401) return { kind: 'unauthenticated' };
    if (response.response.status === 403) return { kind: 'forbidden' };
    if (response.response.status === 404) return { kind: 'not_found' };
    if (response.response.status !== 200 || !response.data) return { kind: 'unavailable' };

    const { data, meta } = response.data;
    const skip = (page - 1) * ASSIGNMENTS_PER_PAGE;
    if (
      !Array.isArray(data) ||
      data.length > ASSIGNMENTS_PER_PAGE ||
      !meta ||
      !Number.isSafeInteger(meta.total) ||
      meta.total < 0 ||
      meta.take !== ASSIGNMENTS_PER_PAGE ||
      meta.skip !== skip ||
      meta.totalPages !== Math.ceil(meta.total / ASSIGNMENTS_PER_PAGE) ||
      data.length > Math.max(0, meta.total - skip)
    ) {
      return { kind: 'unavailable' };
    }

    const assignments: Extract<TrainerClientAssignmentsResult, { kind: 'ready' }>['assignments'] =
      [];
    const ids = new Set<string>();
    for (const item of data) {
      const relation = item.trainerAthlete;
      const version = item.version;
      const program = version && 'program' in version ? version.program : null;
      if (
        typeof item.id !== 'string' ||
        item.id.length === 0 ||
        ids.has(item.id) ||
        item.trainerAthleteId.toLowerCase() !== relationId.toLowerCase() ||
        !relation ||
        relation.id.toLowerCase() !== relationId.toLowerCase() ||
        relation.status !== 'ACTIVE' ||
        !program ||
        typeof program.trainerId !== 'string' ||
        program.trainerId !== relation.trainerId ||
        typeof version.title !== 'string' ||
        !version.title.trim() ||
        !Number.isSafeInteger(version.version) ||
        version.version < 1 ||
        !(['ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED'] as string[]).includes(item.status)
      ) {
        return { kind: 'unavailable' };
      }

      ids.add(item.id);
      assignments.push({
        id: item.id,
        title: version.title,
        version: version.version,
        status: item.status,
      });
    }

    return { kind: 'ready', assignments, total: meta.total, page, totalPages: meta.totalPages };
  } catch {
    // Invalid upstream, redirect, timeout and JSON errors cannot leak
    // credentials or render any partially validated program details.
    return { kind: 'unavailable' };
  }
}
