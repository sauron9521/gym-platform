/**
 * Public, pure Workouts authorization contract for dependent feature modules.
 *
 * Consumers must supply CURRENT persisted capabilities, not a JWT role.
 * Re-export the canonical policy without copying or weakening its behavior.
 * Calling the assertion does not perform DB reads on its own.
 */
export { assertWorkoutAthlete } from './policies/workout-access.policy.js';
