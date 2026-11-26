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

// Shared account adapter contracts; storage, repository and cleanup remain private.
export { UsersService } from './services/users.service.js';
export { AvatarSelfFacade } from './avatar/avatar-self.facade.js';
export { MAX_AVATAR_SIZE } from './avatar/avatar-validation.js';
export type { AvatarUploadFile } from './avatar/avatar-validation.js';
export { updateMyProfileSchema } from './dto/update-my-profile.dto.js';
export type { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';
export { updateMyPreferencesSchema } from './dto/update-my-preferences.dto.js';
export type { UpdateMyPreferencesDto } from './dto/update-my-preferences.dto.js';
export { updateMyWorkoutPreferencesSchema } from './dto/update-my-workout-preferences.dto.js';
export type { UpdateMyWorkoutPreferencesDto } from './dto/update-my-workout-preferences.dto.js';
