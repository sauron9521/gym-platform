/**
 * Live grants returned by NestJS, not the legacy account.role or a client flag.
 * Missing, malformed and ADMIN grants never unlock Athlete/Trainer UI.
 * All resource authorization is still enforced by the API.
 */
export type AccountCapabilities = {
  athlete: boolean;
  trainer: boolean;
  admin: boolean;
};

export function parseAccountCapabilities(value: unknown): AccountCapabilities | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const grants = value as Record<string, unknown>;
  if (
    typeof grants.athlete !== 'boolean' ||
    typeof grants.trainer !== 'boolean' ||
    typeof grants.admin !== 'boolean'
  )
    return null;
  return { athlete: grants.athlete, trainer: grants.trainer, admin: grants.admin };
}

export function hasMobileAccess(value: AccountCapabilities | null | undefined): boolean {
  return Boolean(value && !value.admin && (value.athlete || value.trainer));
}

export function hasAthleteAccess(value: AccountCapabilities | null | undefined): boolean {
  return Boolean(value?.athlete && !value.admin);
}

export function hasTrainerAccess(value: AccountCapabilities | null | undefined): boolean {
  return Boolean(value?.trainer && !value.admin);
}
