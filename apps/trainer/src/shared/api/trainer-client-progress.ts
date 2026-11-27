import { parseInstant, rollingDaysStart } from '@gym/datetime';
import { createTrainerServerApiClient } from './trainer-server-api';

const RELATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrainerClientProgressResult =
  | {
      kind: 'ready';
      clientEmail: string;
      asOf: string;
      windowStart: string;
      activeProgramAssignments: number;
      completedProgramWorkouts30d: number;
    }
  | { kind: 'unauthenticated' | 'forbidden' | 'not_found' | 'unavailable' };

function isValidCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Server-only, read-only client details. The scoped progress endpoint authorizes
 * the current trainer + ACTIVE relationship before we request identity metadata.
 * Never use GET /workouts: that endpoint is intentionally athlete-owned.
 */
export async function loadTrainerClientProgress(
  cookieHeader: string,
  relationId: string,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerClientProgressResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!RELATION_ID_RE.test(relationId)) return { kind: 'not_found' };

  try {
    const api = createTrainerServerApiClient(cookieHeader, configuredOrigin, send);
    const progress = await api.GET('/trainer-dashboard/clients/{relationId}/progress', {
      params: { path: { relationId } },
    });

    if (progress.response.status === 401) return { kind: 'unauthenticated' };
    if (progress.response.status === 403) return { kind: 'forbidden' };
    if (progress.response.status === 404) return { kind: 'not_found' };
    if (progress.response.status !== 200 || !progress.data) return { kind: 'unavailable' };

    const { asOf, windowStart, activeProgramAssignments, completedProgramWorkouts30d } =
      progress.data;
    const end = parseInstant(asOf);
    const start = parseInstant(windowStart);
    if (
      typeof asOf !== 'string' ||
      typeof windowStart !== 'string' ||
      !end ||
      !start ||
      rollingDaysStart(end, 30).getTime() !== start.getTime() ||
      !isValidCount(activeProgramAssignments) ||
      !isValidCount(completedProgramWorkouts30d)
    ) {
      return { kind: 'unavailable' };
    }

    // Only fetch identifying fields after the strict progress permission check.
    // The second endpoint can independently deny access if moderation happened.
    const relation = await api.GET('/trainer-athletes/{id}', {
      params: { path: { id: relationId } },
    });
    if (relation.response.status === 401) return { kind: 'unauthenticated' };
    if (relation.response.status === 403) return { kind: 'forbidden' };
    if (relation.response.status === 404) return { kind: 'not_found' };
    if (relation.response.status !== 200 || !relation.data) return { kind: 'unavailable' };

    const data = relation.data;
    if (
      typeof data.id !== 'string' ||
      data.id.toLowerCase() !== relationId.toLowerCase() ||
      data.status !== 'ACTIVE' ||
      !data.athlete ||
      !('email' in data.athlete) ||
      typeof data.athlete.email !== 'string' ||
      data.athlete.email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.athlete.email)
    ) {
      // Historical/redacted or mismatched identities must not be displayed.
      return { kind: 'not_found' };
    }

    return {
      kind: 'ready',
      clientEmail: data.athlete.email,
      asOf,
      windowStart,
      activeProgramAssignments,
      completedProgramWorkouts30d,
    };
  } catch {
    // Never emit upstream details, session cookies or partially loaded private data.
    return { kind: 'unavailable' };
  }
}
