// Existing relationship operations and capability-checked dashboard reads.
export { TrainerAthletesService } from './services/trainer-athletes.service.js';
export { TrainerDashboardService } from './services/trainer-dashboard.service.js';
export type { TrainerAthleteActor } from './types/trainer-athlete.types.js';
export { trainerAthleteIdSchema } from './dto/trainer-athlete.schemas.js';
export {
  createTrainerAthleteSchema,
  type CreateTrainerAthleteDto,
} from './dto/create-trainer-athlete.dto.js';
export {
  queryTrainerAthletesSchema,
  type QueryTrainerAthletesDto,
} from './dto/query-trainer-athletes.dto.js';
export {
  terminateTrainerAthleteSchema,
  type TerminateTrainerAthleteDto,
} from './dto/terminate-trainer-athlete.dto.js';
export {
  trainerDashboardOverviewResponse,
  trainerClientProgressResponse,
} from './trainer-dashboard.responses.js';
