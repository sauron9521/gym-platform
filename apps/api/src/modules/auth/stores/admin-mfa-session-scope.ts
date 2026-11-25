import type { SessionRecord } from '@nestjs/authentication';

import type { Prisma } from '#prisma/client';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';

// Server-written provenance, never copied from client input. Old synthetic
// verified rows cannot become trusted after deploying the scoped reader.
export const ADMIN_MFA_FLOW = 'challenge-v1';
export const ADMIN_MFA_METADATA = { purpose: ADMIN_SESSION_PURPOSE, adminMfaFlow: ADMIN_MFA_FLOW };

export type AdminMfaMethod = 'totp' | 'recovery';
export type AdminMfaIssuance =
  | { state: 'pending' }
  | { state: 'verified'; method: 'totp' }
  | { state: 'verified'; method: 'recovery'; fence: Date };

export const ADMIN_RECOVERY_TTL_MS = 10 * 60 * 1000;

/** Interpret only the server-owned persisted assurance, never client proof claims. */
export function readAdminMfaAssurance(
  record: Pick<SessionRecord, 'mfa' | 'metadata'>,
): 'password' | AdminMfaMethod | null {
  const metadata = record.metadata;
  if (metadata?.purpose !== ADMIN_SESSION_PURPOSE || metadata.adminMfaFlow !== ADMIN_MFA_FLOW) {
    return null;
  }
  const method = metadata.adminMfaMethod;
  const fence = metadata.adminRecoveryFence;
  if (record.mfa === 'pending' && method === undefined && fence === undefined) {
    return 'password';
  }
  if (record.mfa === 'verified' && method === 'totp' && fence === undefined) return 'totp';
  if (record.mfa === 'verified' && method === 'recovery' && typeof fence === 'string') {
    const time = new Date(fence);
    if (Number.isFinite(time.getTime()) && time.toISOString() === fence) return 'recovery';
  }
  return null;
}

/** A recovery grant belongs to the exact revocation epoch that created it. */
export function isCurrentRecoveryGrant(
  record: SessionRecord,
  fence: Date | null,
  now: number,
): boolean {
  return (
    readAdminMfaAssurance(record) === 'recovery' &&
    fence !== null &&
    record.metadata?.adminRecoveryFence === fence.toISOString() &&
    record.createdAt.getTime() <= fence.getTime() &&
    now >= fence.getTime() &&
    now < record.createdAt.getTime() + ADMIN_RECOVERY_TTL_MS
  );
}

export function adminMfaSessionScope(id: string): Prisma.SessionWhereInput {
  return {
    id,
    mfa: { in: ['pending', 'verified'] },
    AND: [
      { metadata: { path: ['purpose'], equals: ADMIN_SESSION_PURPOSE } },
      { metadata: { path: ['adminMfaFlow'], equals: ADMIN_MFA_FLOW } },
    ],
  };
}
