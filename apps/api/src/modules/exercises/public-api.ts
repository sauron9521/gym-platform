/**
 * Exercise-domain read contract consumed by transactional workout creation.
 *
 * Workouts must use the canonical Exercises visibility predicate and minimal
 * reference projection. Re-export the existing values without copying their
 * definitions or moving authorization outside the workout write transaction.
 *
 * Callers still own the current-user, exercise and relationship row locks and
 * must recheck eligibility in the same PostgreSQL transaction as INSERT.
 */
export { buildExerciseVisibilityWhere } from './policies/exercise-access.policy.js';
export { workoutExerciseReferenceSelect } from './selects/exercise.select.js';

// Type-only relationship visibility context; no new runtime dependency.
export type { ExerciseAccessContext } from './types/exercise.types.js';
