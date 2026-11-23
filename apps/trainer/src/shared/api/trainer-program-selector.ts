import { createTrainerServerApiClient } from './trainer-server-api';

const PROGRAM_PAGE_SIZE = 8;
const MAX_PAGE = 10_000;
const VERSION_PAGE_SIZE = 40;
const MAX_VERSION_NUMBER = 2_147_483_647;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type QueryValue = string | readonly string[] | undefined;
type ProgramSelectorQuery = {
  page: number;
  programId?: QueryValue;
  versionId?: QueryValue;
  beforeVersion?: number;
};

type ProgramChoice = { id: string; title: string };
type VersionChoice = { id: string; title: string; version: number };

type VersionSelection =
  | { kind: 'none' | 'not_found' | 'unavailable' }
  | {
      kind: 'ready';
      program: ProgramChoice;
      versions: VersionChoice[];
      selectedVersion: VersionChoice | null;
      nextBeforeVersion: number | null;
    };

export type TrainerProgramSelectorResult =
  | {
      kind: 'ready';
      programs: ProgramChoice[];
      total: number;
      page: number;
      totalPages: number;
      selection: VersionSelection;
    }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

export function parseProgramChoicePage(value: QueryValue): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,4}$/.test(value)) return 1;
  const parsed = Number(value);
  return parsed <= MAX_PAGE ? parsed : 1;
}

export function parseVersionCursor(value: QueryValue): number | undefined {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,9}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed <= MAX_VERSION_NUMBER ? parsed : undefined;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isPublishedAt(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

async function loadPublishedVersionSelection(
  api: ReturnType<typeof createTrainerServerApiClient>,
  program: ProgramChoice,
  versionId: QueryValue,
  beforeVersion: number | undefined,
): Promise<VersionSelection | { kind: 'unauthenticated' } | { kind: 'forbidden' }> {
  const { response, data: page } = await api.GET(
    '/training-programs/{programId}/published-versions',
    {
      params: {
        path: { programId: program.id },
        query: { limit: VERSION_PAGE_SIZE, beforeVersion },
      },
    },
  );
  if (response.status === 401) return { kind: 'unauthenticated' };
  if (response.status === 403) return { kind: 'forbidden' };
  if (response.status === 404) return { kind: 'not_found' };
  if (
    response.status !== 200 ||
    !Array.isArray(page?.data) ||
    page.data.length > VERSION_PAGE_SIZE
  ) {
    return { kind: 'unavailable' };
  }

  const versions: VersionChoice[] = [];
  const ids = new Set<string>();
  let previous = beforeVersion ?? MAX_VERSION_NUMBER + 1;
  for (const row of page.data) {
    if (
      !row ||
      !isUuid(row.id) ||
      ids.has(row.id.toLowerCase()) ||
      row.programId !== program.id ||
      row.status !== 'PUBLISHED' ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1 ||
      row.version >= previous ||
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      !isPublishedAt(row.publishedAt)
    ) {
      return { kind: 'unavailable' };
    }
    previous = row.version;
    ids.add(row.id.toLowerCase());
    versions.push({ id: row.id, title: row.title, version: row.version });
  }

  const { nextBeforeVersion } = page;
  if (
    nextBeforeVersion !== null &&
    (versions.length !== VERSION_PAGE_SIZE || nextBeforeVersion !== previous || previous <= 1)
  ) {
    return { kind: 'unavailable' };
  }

  return {
    kind: 'ready',
    program,
    versions,
    nextBeforeVersion,
    selectedVersion: isUuid(versionId)
      ? (versions.find((version) => version.id.toLowerCase() === versionId.toLowerCase()) ?? null)
      : null,
  };
}

/**
 * A bounded read-only chooser, not an assignment intent/commit.
 * Current-grant and ACTIVE collaboration checks run in the protected route
 * before this loader; Nest remains authoritative for trainer-owned programs.
 */
export async function loadTrainerProgramSelector(
  cookieHeader: string,
  { page, programId, versionId, beforeVersion }: ProgramSelectorQuery,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerProgramSelectorResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE ||
    (beforeVersion !== undefined &&
      (!Number.isSafeInteger(beforeVersion) ||
        beforeVersion < 1 ||
        beforeVersion > MAX_VERSION_NUMBER))
  ) {
    return { kind: 'unavailable' };
  }

  try {
    const api = createTrainerServerApiClient(cookieHeader, configuredOrigin, send);
    const response = await api.GET('/training-programs', {
      params: { query: { page, limit: PROGRAM_PAGE_SIZE, status: 'PUBLISHED' } },
    });
    if (response.response.status === 401) return { kind: 'unauthenticated' };
    if (response.response.status === 403) return { kind: 'forbidden' };
    if (response.response.status !== 200 || !response.data) return { kind: 'unavailable' };

    const { data, meta } = response.data;
    const skip = (page - 1) * PROGRAM_PAGE_SIZE;
    if (
      !Array.isArray(data) ||
      data.length > PROGRAM_PAGE_SIZE ||
      !meta ||
      !Number.isSafeInteger(meta.total) ||
      meta.total < 0 ||
      meta.skip !== skip ||
      meta.take !== PROGRAM_PAGE_SIZE ||
      meta.totalPages !== Math.ceil(meta.total / PROGRAM_PAGE_SIZE) ||
      data.length > Math.max(0, meta.total - skip)
    ) {
      return { kind: 'unavailable' };
    }

    const programs: ProgramChoice[] = [];
    const ids = new Set<string>();
    for (const item of data) {
      const latest = item.versions?.[0];
      if (
        !isUuid(item.id) ||
        ids.has(item.id) ||
        !isUuid(item.trainerId) ||
        item.status !== 'PUBLISHED' ||
        !Array.isArray(item.versions) ||
        item.versions.length !== 1 ||
        !latest ||
        !isUuid(latest.id) ||
        (latest.status !== 'PUBLISHED' && latest.status !== 'DRAFT') ||
        typeof latest.title !== 'string' ||
        !latest.title.trim()
      ) {
        return { kind: 'unavailable' };
      }
      ids.add(item.id);
      // The title previews the latest version; this may itself be a DRAFT.
      // Draft versions are never offered in the actual version selector.
      programs.push({ id: item.id, title: latest.title });
    }

    // Only use the canonical program ID from the current scoped program page.
    const program = isUuid(programId)
      ? programs.find((entry) => entry.id.toLowerCase() === programId.toLowerCase())
      : undefined;
    const selection = program
      ? await loadPublishedVersionSelection(api, program, versionId, beforeVersion)
      : ({ kind: programId === undefined ? 'none' : 'not_found' } as const);
    if (selection.kind === 'unauthenticated' || selection.kind === 'forbidden') return selection;

    return {
      kind: 'ready',
      programs,
      total: meta.total,
      page,
      totalPages: meta.totalPages,
      selection,
    };
  } catch {
    // No partial response, session cookie or upstream error crosses the SSR boundary.
    return { kind: 'unavailable' };
  }
}
