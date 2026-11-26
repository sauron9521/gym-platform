/**
 * Stable Users feature contracts. Capability policy remains pure.
 *
 * Callers must load an up-to-date account snapshot and enforce authorization
 * within their own write transaction. This function does not perform reads,
 * acquire locks or grant permissions on its own.
 */
export { deriveAccountCapabilities } from './policies/account-capabilities.policy.js';
export type {
  AccountCapabilities,
  AccountCapabilitySnapshot,
} from './policies/account-capabilities.policy.js';

// Privileged read adapter contract. DI ownership stays in UsersModule.
export { AdminUsersReadService } from './services/admin-users-read.service.js';
export type { AdminUsersReadActor } from './services/admin-users-read.service.js';
export { adminUsersQuerySchema } from './dto/admin-users-query.dto.js';
export type { AdminUsersQuery } from './dto/admin-users-query.dto.js';
