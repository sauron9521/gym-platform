import { z } from 'zod';

/**
 * Temporary operator-only privilege bootstrap. Never parse individual valid
 * IDs from a partially invalid list: the entire setting must fail closed.
 */
const MAX_OPERATOR_ADMINS = 20;
const MAX_CONFIG_LENGTH = 1024;

export function parseOperatorSuperAdminIds(value: unknown): ReadonlySet<string> {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_CONFIG_LENGTH) {
    return new Set();
  }

  const entries = value.split(',');
  if (
    entries.length > MAX_OPERATOR_ADMINS ||
    entries.some((id) => !z.uuid().safeParse(id.trim()).success)
  ) {
    return new Set();
  }

  const normalized = entries.map((id) => id.trim().toLowerCase());
  const unique = new Set(normalized);
  return unique.size === normalized.length ? unique : new Set();
}

/** Validate the whole setting at application startup without exposing raw IDs. */
export function isValidOperatorSuperAdminIds(value: string): boolean {
  return parseOperatorSuperAdminIds(value).size === value.split(',').length;
}
