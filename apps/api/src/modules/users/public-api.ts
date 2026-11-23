/**
 * Stable, pure Users-domain contract for other feature modules.
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
