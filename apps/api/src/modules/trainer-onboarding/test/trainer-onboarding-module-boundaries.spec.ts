import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { TrainerOnboardingModule } from '../trainer-onboarding.module.js';
import * as publicApi from '../public-api.js';
import { TrainerApplicationsRepository } from '../repositories/trainer-applications.repository.js';
import { TrainerReviewRepository } from '../repositories/trainer-review.repository.js';

describe('TrainerOnboardingModule public boundary', () => {
  it('exports exactly the two application services and keeps persistence private', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      TrainerOnboardingModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      TrainerOnboardingModule,
    ) as unknown[];
    expect(exports).toEqual([publicApi.TrainerApplicationsService, publicApi.TrainerReviewService]);
    for (const provider of exports) expect(providers).toContain(provider);
    for (const repository of [TrainerApplicationsRepository, TrainerReviewRepository]) {
      expect(providers).toContain(repository);
      expect(exports).not.toContain(repository);
    }
  });

  it('exposes only the named application contracts and validation schemas at runtime', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'TrainerApplicationsService',
        'TrainerReviewService',
        'trainerApplicationInputSchema',
        'trainerReviewApplicationIdSchema',
        'trainerReviewDecisionSchema',
      ].sort(),
    );
  });

  it('keeps the exported service methods limited to their existing use cases', () => {
    expect(
      Object.getOwnPropertyNames(publicApi.TrainerApplicationsService.prototype)
        .filter((name) => name !== 'constructor' && name !== 'assertEligible')
        .sort(),
    ).toEqual(['findMine', 'submit', 'updateMine']);
    expect(
      Object.getOwnPropertyNames(publicApi.TrainerReviewService.prototype)
        .filter((name) => name !== 'constructor' && name !== 'assertOperator')
        .sort(),
    ).toEqual(['decide', 'findPending']);
  });
});
