import { dateTimeSchema, integerSchema, objectSchema } from '#src/infra/openapi/response-contracts';

export const trainerDashboardOverviewResponse = objectSchema({
  asOf: dateTimeSchema,
  windowStart: dateTimeSchema,
  activeClients: integerSchema,
  activeProgramAssignments: integerSchema,
  completedProgramWorkouts30d: integerSchema,
});

export const trainerClientProgressResponse = objectSchema({
  asOf: dateTimeSchema,
  windowStart: dateTimeSchema,
  activeProgramAssignments: integerSchema,
  completedProgramWorkouts30d: integerSchema,
});
