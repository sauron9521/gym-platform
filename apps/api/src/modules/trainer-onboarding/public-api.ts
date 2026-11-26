// Explicit application contracts for the Shared and Admin HTTP adapters.
// Repositories, Prisma projections and infrastructure remain private.
export { TrainerApplicationsService } from './services/trainer-applications.service.js';
export { TrainerReviewService, type Reviewer } from './services/trainer-review.service.js';
export type { TrainerReviewAction } from './domain/trainer-application.lifecycle.js';

export {
  trainerApplicationInputSchema,
  type TrainerApplicationInput,
} from './dto/trainer-application.schemas.js';
export {
  trainerReviewApplicationIdSchema,
  trainerReviewDecisionSchema,
  type TrainerReviewDecision,
} from './dto/trainer-review.schemas.js';
