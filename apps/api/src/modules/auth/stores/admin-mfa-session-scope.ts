import type { Prisma } from '#prisma/client';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';

// Server-written provenance, never copied from client input. Old synthetic
// verified rows cannot become trusted after deploying the scoped reader.
export const ADMIN_MFA_FLOW = 'challenge-v1';
export const ADMIN_MFA_METADATA = { purpose: ADMIN_SESSION_PURPOSE, adminMfaFlow: ADMIN_MFA_FLOW };

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
