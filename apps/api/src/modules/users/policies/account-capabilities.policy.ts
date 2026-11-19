import type { Role } from '#prisma/client';

export type AccountCapabilitySnapshot = {
  role: Role;
  trainerProfile: { isActive: boolean } | null;
};

export type AccountCapabilities = {
  athlete: boolean;
  trainer: boolean;
  admin: boolean;
};

/**
 * Derived from the CURRENT database state, never from a JWT role claim.
 * Legacy TRAINER accounts without a profile remain compatible during migration.
 * An explicitly revoked trainer profile overrides any legacy role.
 */
export function deriveAccountCapabilities(account: AccountCapabilitySnapshot): AccountCapabilities {
  const isAdmin = account.role === 'ADMIN';
  return {
    athlete: !isAdmin,
    trainer:
      !isAdmin &&
      (account.trainerProfile?.isActive === true ||
        (account.role === 'TRAINER' && account.trainerProfile === null)),
    admin: isAdmin,
  };
}
