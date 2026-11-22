import type { SessionRecord } from '@nestjs/authentication';
import { ADMIN_SESSION_PURPOSE } from './admin-session-purpose.guard.js';

/** Admin cookies expire after one work shift, even when actively used. */
export const ADMIN_SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
/** Admin sessions time out after 15 minutes without recorded activity. */
export const ADMIN_SESSION_IDLE_TTL_MS = 15 * 60 * 1000;

type LifetimeFields = Pick<SessionRecord, 'createdAt' | 'expiresAt' | 'lastActiveAt' | 'metadata'>;

export function isAdminPurposeSession(record: Pick<SessionRecord, 'metadata'>): boolean {
  return record.metadata?.purpose === ADMIN_SESSION_PURPOSE;
}

/**
 * The session service calculates Set-Cookie Max-Age from the same SessionRecord
 * after SessionStore.createSession() returns. Cap its expiry in place BEFORE
 * persisting it so the browser's Max-Age and PostgreSQL expiry agree.
 * This also caps MFA completion/rotation, which reissues a SessionRecord.
 */
export function capAdminSessionExpiry(record: SessionRecord): void {
  if (!isAdminPurposeSession(record)) return;
  const cap = record.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS;
  if (record.expiresAt.getTime() > cap) record.expiresAt = new Date(cap);
}

/**
 * Fail closed using the persisted snapshot BEFORE SessionService.validate()
 * touches lastActiveAt. Also bounds older admin-purpose sessions issued before
 * this policy, whose persisted expiresAt may still reflect the regular 7d TTL.
 */
export function isAdminSessionExpired(record: LifetimeFields, now: number): boolean {
  if (!isAdminPurposeSession(record)) return false;
  const absolute = Math.min(
    record.expiresAt.getTime(),
    record.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS,
  );
  const idle = record.lastActiveAt.getTime() + ADMIN_SESSION_IDLE_TTL_MS;
  return !Number.isFinite(absolute) || !Number.isFinite(idle) || now >= absolute || now >= idle;
}
