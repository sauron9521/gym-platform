import type { operations } from '@gym/api-client';

type AssignmentBody =
  operations['TrainingProgramAssignmentsController_assignVersionToAthlete']['requestBody']['content']['application/json'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One browser-originated POST, never a refresh/retry/refresh-token loop.
 * HTTP 5xx, network loss, timeouts and malformed 201 are ambiguous: the
 * server may have committed the assignment. The caller MUST NOT POST again.
 */
export type TrainerAssignVersionResult =
  | { kind: 'created'; assignmentId: string }
  | {
      kind:
        | 'unauthenticated'
        | 'forbidden'
        | 'not_found'
        | 'conflict'
        | 'invalid'
        | 'rate_limited'
        | 'uncertain';
    };

export async function assignTrainerVersion(
  relationId: string,
  programId: string,
  versionId: string,
  send: typeof fetch = fetch,
): Promise<TrainerAssignVersionResult> {
  if (![relationId, programId, versionId].every((value) => UUID.test(value))) {
    return { kind: 'invalid' };
  }

  const body: AssignmentBody = { trainerAthleteId: relationId };
  const url = `/backend/training-programs/${encodeURIComponent(programId)}/versions/${encodeURIComponent(versionId)}/assignments`;
  try {
    const response = await send(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 404) return { kind: 'not_found' };
    if (response.status === 409) return { kind: 'conflict' };
    if (response.status === 400 || response.status === 422) return { kind: 'invalid' };
    if (response.status === 429) return { kind: 'rate_limited' };
    if (response.status !== 201) return { kind: 'uncertain' };

    // Even a successful HTTP status is not confirmation if the body is lost
    // or references a different relation, program or version.
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { kind: 'uncertain' };
    }
    const record = payload as Record<string, unknown>;
    const version = record.version;
    if (
      typeof record.id !== 'string' ||
      !UUID.test(record.id) ||
      record.status !== 'ACTIVE' ||
      record.trainerAthleteId !== relationId ||
      record.versionId !== versionId ||
      !version ||
      typeof version !== 'object' ||
      Array.isArray(version) ||
      (version as Record<string, unknown>).id !== versionId ||
      (version as Record<string, unknown>).programId !== programId
    ) {
      return { kind: 'uncertain' };
    }
    return { kind: 'created', assignmentId: record.id };
  } catch {
    // Lost POST response is NOT proof of failed database commit.
    return { kind: 'uncertain' };
  }
}
