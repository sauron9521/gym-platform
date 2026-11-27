import { parseInstant, rollingDaysStart } from '@gym/datetime';
import { createTrainerServerApiClient } from './trainer-server-api';

export type TrainerOverviewResult =
  | {
      kind: 'ready';
      asOf: string;
      windowStart: string;
      activeClients: number;
      activeProgramAssignments: number;
      completedProgramWorkouts30d: number;
    }
  | { kind: 'unauthenticated' | 'forbidden' | 'unavailable' };

function isValidCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Current trainer-only aggregates; never derive counts from paginated client rows. */
export async function loadTrainerOverview(
  cookieHeader: string,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerOverviewResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };

  try {
    const api = createTrainerServerApiClient(cookieHeader, configuredOrigin, send);
    const response = await api.GET('/trainer-dashboard/overview');

    if (response.response.status === 401) return { kind: 'unauthenticated' };
    if (response.response.status === 403) return { kind: 'forbidden' };
    if (response.response.status !== 200 || !response.data) return { kind: 'unavailable' };

    const {
      asOf,
      windowStart,
      activeClients,
      activeProgramAssignments,
      completedProgramWorkouts30d,
    } = response.data;
    const end = parseInstant(asOf);
    const start = parseInstant(windowStart);
    if (
      typeof asOf !== 'string' ||
      typeof windowStart !== 'string' ||
      !end ||
      !start ||
      rollingDaysStart(end, 30).getTime() !== start.getTime() ||
      !isValidCount(activeClients) ||
      !isValidCount(activeProgramAssignments) ||
      !isValidCount(completedProgramWorkouts30d)
    ) {
      return { kind: 'unavailable' };
    }

    return {
      kind: 'ready',
      asOf,
      windowStart,
      activeClients,
      activeProgramAssignments,
      completedProgramWorkouts30d,
    };
  } catch {
    // Never leak the upstream, bearer/session secrets or unverified aggregates.
    return { kind: 'unavailable' };
  }
}
