import { MODULE_METADATA } from '@nestjs/common/constants';
import { BodyMeasurementsModule } from '../body-measurements.module.js';
import * as publicApi from '../public-api.js';
import { BodyMeasurementsRepository } from '../repositories/body-measurements.repository.js';
import { BodyMeasurementStatisticsRepository } from '../repositories/body-measurement-statistics.repository.js';
import {
  bodyMeasurementIdSchema,
  createBodyMeasurementSchema,
  queryBodyMeasurementsSchema,
  updateBodyMeasurementSchema,
} from '../dto/body-measurement.schemas.js';
import { bodyMeasurementStatisticsQuerySchema } from '../dto/body-measurement-statistics.schemas.js';

describe('BodyMeasurementsModule public boundary', () => {
  it('exports only the two existing application services, keeping both repositories private', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, BodyMeasurementsModule)).toEqual([
      BodyMeasurementsRepository,
      publicApi.BodyMeasurementsService,
      BodyMeasurementStatisticsRepository,
      publicApi.BodyMeasurementStatisticsService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, BodyMeasurementsModule)).toEqual([
      publicApi.BodyMeasurementsService,
      publicApi.BodyMeasurementStatisticsService,
    ]);
  });

  it('exports exactly the existing adapter schemas and application service identities', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'BodyMeasurementStatisticsService',
      'BodyMeasurementsService',
      'bodyMeasurementIdSchema',
      'bodyMeasurementStatisticsQuerySchema',
      'createBodyMeasurementSchema',
      'queryBodyMeasurementsSchema',
      'updateBodyMeasurementSchema',
    ]);
    expect(publicApi.bodyMeasurementIdSchema).toBe(bodyMeasurementIdSchema);
    expect(publicApi.createBodyMeasurementSchema).toBe(createBodyMeasurementSchema);
    expect(publicApi.queryBodyMeasurementsSchema).toBe(queryBodyMeasurementsSchema);
    expect(publicApi.updateBodyMeasurementSchema).toBe(updateBodyMeasurementSchema);
    expect(publicApi.bodyMeasurementStatisticsQuerySchema).toBe(
      bodyMeasurementStatisticsQuerySchema,
    );
    expect(Object.getOwnPropertyNames(publicApi.BodyMeasurementsService.prototype)).toEqual([
      'constructor',
      'create',
      'findMany',
      'findOne',
      'update',
      'remove',
    ]);
    expect(
      Object.getOwnPropertyNames(publicApi.BodyMeasurementStatisticsService.prototype),
    ).toEqual(['constructor', 'getStatistics']);
  });

  it('rejects client-supplied owner identity in every object input contract', () => {
    for (const [schema, input] of [
      [publicApi.createBodyMeasurementSchema, { weightKg: 80 }],
      [publicApi.updateBodyMeasurementSchema, { weightKg: 81 }],
      [publicApi.queryBodyMeasurementsSchema, {}],
      [publicApi.bodyMeasurementStatisticsQuerySchema, {}],
    ] as const) {
      expect(schema.safeParse(input).success).toBe(true);
      expect(schema.safeParse({ ...input, userId: 'other-owner' }).success).toBe(false);
    }
  });
});
