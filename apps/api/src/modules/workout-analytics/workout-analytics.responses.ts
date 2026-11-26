import {
  arraySchema,
  dateTimeSchema,
  integerSchema,
  nullable,
  objectSchema,
  stringSchema,
  uuidSchema,
  type ResponseSchema,
} from '#src/infra/openapi/response-contracts';

const decimalNumberSchema: ResponseSchema = { type: 'number' };
const dateSchema: ResponseSchema = { type: 'string', format: 'date' };
const rangeSchema: ResponseSchema = { type: 'string', enum: ['7d', '30d', '90d'] };

const summaryDaySchema = objectSchema({
  date: dateSchema,
  workoutCount: integerSchema,
  completedSets: integerSchema,
  strengthVolumeKg: decimalNumberSchema,
});

export const workoutAnalyticsSummaryResponseSchema = objectSchema({
  range: rangeSchema,
  from: dateTimeSchema,
  asOf: dateTimeSchema,
  workoutCount: integerSchema,
  activeDays: integerSchema,
  completedSets: integerSchema,
  strengthVolumeKg: decimalNumberSchema,
  daily: arraySchema(summaryDaySchema),
});

const exerciseDaySchema = objectSchema({
  ...summaryDaySchema.properties!,
  strengthReps: integerSchema,
  bestWeightKg: nullable(decimalNumberSchema),
});

/** One current lifetime best weight per exercise, not a count of improvement events. */
export const workoutAnalyticsPersonalRecordsResponseSchema = objectSchema({
  asOf: dateTimeSchema,
  exerciseCount: integerSchema,
});

export const workoutAnalyticsExerciseResponseSchema = objectSchema({
  range: rangeSchema,
  from: dateTimeSchema,
  asOf: dateTimeSchema,
  exerciseId: uuidSchema,
  name: nullable(stringSchema),
  workoutCount: integerSchema,
  completedSets: integerSchema,
  strengthReps: integerSchema,
  strengthVolumeKg: decimalNumberSchema,
  bestWeightKg: nullable(decimalNumberSchema),
  daily: arraySchema(exerciseDaySchema),
});

export const previousWorkoutSetsResponseSchema = objectSchema({
  exerciseId: uuidSchema,
  workoutCompletedAt: nullable(dateTimeSchema),
  sets: arraySchema(
    objectSchema({
      setNumber: integerSchema,
      setType: { type: 'string', enum: ['WARMUP', 'WORKING', 'DROP_SET', 'AMRAP'] },
      actualReps: nullable(integerSchema),
      actualWeightKg: nullable(decimalNumberSchema),
    }),
  ),
});
