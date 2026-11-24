import { BadRequestException, ConflictException } from '@nestjs/common';

import { ProgramPublicationError } from '../domain/publication.policy.js';
import { PublicationConflict } from '../application/publish-program.use-case.js';

/** Translate only known publication failures at the outer HTTP boundary. */
export function rethrowPublicationHttpError(error: unknown): never {
  if (error instanceof PublicationConflict) {
    throw new ConflictException(error.message);
  }
  if (error instanceof ProgramPublicationError) {
    throw new BadRequestException(error.message);
  }
  throw error;
}
