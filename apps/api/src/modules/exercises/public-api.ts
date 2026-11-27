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
export type { ExerciseAccessContext, ExerciseActor } from './types/exercise.types.js';

// Existing application services and HTTP adapter contracts.
export { ExercisesService } from './services/exercises.service.js';
export { ExerciseTrainerAccessService } from './services/exercise-trainer-access.service.js';
export { exerciseIdSchema } from './dto/exercise.schemas.js';
export { createExerciseSchema, type CreateExerciseDto } from './dto/create-exercise.dto.js';
export { updateExerciseSchema, type UpdateExerciseDto } from './dto/update-exercise.dto.js';
export { queryExercisesSchema, type QueryExercisesDto } from './dto/query-exercises.dto.js';
export {
  exerciseTrainerAccessIdSchema,
  grantExerciseTrainerAccessSchema,
  type GrantExerciseTrainerAccessDto,
} from './dto/exercise-trainer-access.dto.js';
