import { createTrainerServerApiClient } from './trainer-server-api';

const PROGRAM_PAGE_SIZE = 8;
const MAX_PAGE = 10_000;
const MAX_VERSION_ROWS = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProgramChoice = { id: string; title: string };
type VersionChoice = { id: string; title: string; version: number };

type VersionSelection =
  | { kind: 'none' | 'not_found' | 'unavailable' }
  | {
      kind: 'ready';
      program: ProgramChoice;
      versions: VersionChoice[];
      selectedVersion: VersionChoice | null;
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

export function parseProgramChoicePage(value: string | readonly string[] | undefined): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,4}$/.test(value)) return 1;
  const parsed = Number(value);
  return parsed <= MAX_PAGE ? parsed : 1;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isPublishedAt(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * A bounded read-only chooser, not an assignment intent/commit.
 * Current-grant and ACTIVE collaboration checks run in the protected route
 * before this loader; Nest remains authoritative for trainer-owned programs.
 */
export async function loadTrainerProgramSelector(
  cookieHeader: string,
  page: number,
  selectedProgramId: string | readonly string[] | undefined,
  selectedVersionId: string | readonly string[] | undefined,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerProgramSelectorResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
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

    let selection: VersionSelection = { kind: 'none' };
    if (selectedProgramId !== undefined) {
      if (!isUuid(selectedProgramId)) {
        selection = { kind: 'not_found' };
      } else {
        const program = programs.find(
          (entry) => entry.id.toLowerCase() === selectedProgramId.toLowerCase(),
        );
        if (!program) {
          // Never issue a user-controlled foreign program lookup.
          selection = { kind: 'not_found' };
        } else {
          const versionsResponse = await api.GET('/training-programs/{programId}/versions', {
            params: { path: { programId: program.id } },
          });
          if (versionsResponse.response.status === 401) return { kind: 'unauthenticated' };
          if (versionsResponse.response.status === 403) return { kind: 'forbidden' };
          if (versionsResponse.response.status === 404) {
            selection = { kind: 'not_found' };
          } else if (versionsResponse.response.status !== 200 || !versionsResponse.data) {
            selection = { kind: 'unavailable' };
          } else {
            const source = versionsResponse.data;
            if (!Array.isArray(source) || source.length > MAX_VERSION_ROWS) {
              selection = { kind: 'unavailable' };
            } else {
              const versions: VersionChoice[] = [];
              const versionIds = new Set<string>();
              const versionNumbers = new Set<number>();
              let valid = true;
              for (const v of source) {
                if (
                  !isUuid(v.id) ||
                  versionIds.has(v.id) ||
                  v.programId !== program.id ||
                  !Number.isSafeInteger(v.version) ||
                  v.version < 1 ||
                  versionNumbers.has(v.version) ||
                  (v.status !== 'DRAFT' && v.status !== 'PUBLISHED') ||
                  typeof v.title !== 'string' ||
                  !v.title.trim() ||
                  (v.status === 'PUBLISHED' && !isPublishedAt(v.publishedAt))
                ) {
                  valid = false;
                  break;
                }
                versionIds.add(v.id);
                versionNumbers.add(v.version);
                if (v.status === 'PUBLISHED') {
                  versions.push({ id: v.id, title: v.title, version: v.version });
                }
              }
              selection = valid
                ? {
                    kind: 'ready',
                    program,
                    versions,
                    selectedVersion: isUuid(selectedVersionId)
                      ? (versions.find(
                          (v) => v.id.toLowerCase() === selectedVersionId.toLowerCase(),
                        ) ?? null)
                      : null,
                  }
                : { kind: 'unavailable' };
            }
          }
        }
      }
    }

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
