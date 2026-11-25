import type { SessionRecord } from '@nestjs/authentication';

import type { Prisma } from '#prisma/client';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';

// Server-written provenance, never copied from client input. Old synthetic
// verified rows cannot become trusted after deploying the scoped reader.
export const ADMIN_MFA_FLOW = 'challenge-v1';
export const ADMIN_MFA_METADATA = { purpose: ADMIN_SESSION_PURPOSE, adminMfaFlow: ADMIN_MFA_FLOW };

export type AdminMfaMethod = 'totp' | 'recovery';
export type AdminMfaIssuance = { state: 'pending' } | { state: 'verified'; method: AdminMfaMethod };

/** Interpret only the server-owned persisted assurance, never client proof claims. */
export function readAdminMfaAssurance(
  record: Pick<SessionRecord, 'mfa' | 'metadata'>,
): 'password' | AdminMfaMethod | null {
  const metadata = record.metadata;
  if (metadata?.purpose !== ADMIN_SESSION_PURPOSE || metadata.adminMfaFlow !== ADMIN_MFA_FLOW) {
    return null;
  }
  const method = metadata.adminMfaMethod;
  if (record.mfa === 'pending' && method === undefined) return 'password';
  if (record.mfa === 'verified' && (method === 'totp' || method === 'recovery')) {
    return method;
  }
  return null;
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
