import { BadRequestException } from '@nestjs/common';

import {
  assertPublishableVersion as assertDomainPublishableVersion,
  ProgramPublicationError,
  type PublishableVersion,
} from '../domain/publication.policy.js';

/**
 * Compatibility adapter for the legacy service and locked repository call sites.
 * Keep the existing HTTP exception until the publication use case is migrated.
 */
export function assertPublishableVersion(version: PublishableVersion): void {
  try {
    assertDomainPublishableVersion(version);
  } catch (error) {
    if (error instanceof ProgramPublicationError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
