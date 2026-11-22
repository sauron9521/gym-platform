import type { SessionRecord } from '@nestjs/authentication';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_SESSION_ABSOLUTE_TTL_MS,
  ADMIN_SESSION_IDLE_TTL_MS,
  capAdminSessionExpiry,
  isAdminSessionExpired,
} from './admin-session-lifetime.policy.js';

const start = new Date('2026-11-22T10:00:00.000Z');
function session(metadata: SessionRecord['metadata'] = { purpose: 'admin' }): SessionRecord {
  return {
    id: 'session-id',
    userId: 'admin-id',
    createdAt: new Date(start),
    expiresAt: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
    lastActiveAt: new Date(start),
    metadata,
  };
}

describe('admin-purpose session lifetime', () => {
  it('caps absolute expiry at 8h without touching a regular session', () => {
    const admin = session();
    capAdminSessionExpiry(admin);
    expect(admin.expiresAt.getTime()).toBe(start.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS);

    const regular = session({ device: 'mobile' });
    capAdminSessionExpiry(regular);
    expect(regular.expiresAt.getTime()).toBe(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  it('never lengthens a pending-MFA session with a shorter 10-minute expiry', () => {
    const admin = session();
    admin.expiresAt = new Date(start.getTime() + 10 * 60 * 1000);
    capAdminSessionExpiry(admin);
    expect(admin.expiresAt.getTime()).toBe(start.getTime() + 10 * 60 * 1000);
  });

  it('enforces idle cutoff inclusively from persisted lastActiveAt', () => {
    const admin = session();
    const cutoff = start.getTime() + ADMIN_SESSION_IDLE_TTL_MS;
    expect(isAdminSessionExpired(admin, cutoff - 1)).toBe(false);
    expect(isAdminSessionExpired(admin, cutoff)).toBe(true);
  });

  it('enforces an 8h ceiling even for legacy 7-day admin-purpose rows', () => {
    const admin = session();
    admin.lastActiveAt = new Date(start.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS - 1000);
    expect(isAdminSessionExpired(admin, start.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS - 1)).toBe(
      false,
    );
    expect(isAdminSessionExpired(admin, start.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS)).toBe(
      true,
    );
    expect(isAdminSessionExpired(session({ purpose: 'web' }), start.getTime() + 36e5)).toBe(false);
  });

  it('fails closed for corrupted dates on admin-purpose records', () => {
    const admin = session();
    admin.lastActiveAt = new Date(Number.NaN);
    expect(isAdminSessionExpired(admin, start.getTime())).toBe(true);
  });
});
