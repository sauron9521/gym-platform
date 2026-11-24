import { NotFoundException } from '@nestjs/common';

import { PublishProgramUseCase } from './application/publish-program.use-case.js';
import type { PublishProgramPort } from './application/ports/publish-program.port.js';
import type { TrainingProgramVersionRepository } from './repositories/training-program-version.repository.js';
import type { TrainingProgramCrudService } from './services/training-program-crud.service.js';
import type { TrainingProgramVersionPayload } from './types/training-program-payload.types.js';

export const PUBLISH_PROGRAM_USE_CASE = Symbol('PUBLISH_PROGRAM_USE_CASE');

export function createPublishProgramUseCase(
  repository: TrainingProgramVersionRepository,
  crudService: TrainingProgramCrudService,
): PublishProgramUseCase<TrainingProgramVersionPayload> {
  const port: PublishProgramPort<TrainingProgramVersionPayload> = {
    async loadOwnedProgramStatus({ programId, actor }) {
      return (await crudService.findOne(programId, actor)).status;
    },
    async loadOwnedVersion({ programId, versionId, actor }) {
      // Preserve the second fresh access check from the legacy findVersion path.
      await crudService.findOne(programId, actor);
      const version = await repository.findVersionById(versionId, { programId });
      if (!version) {
        throw new NotFoundException('Training program version not found');
      }
      return version;
    },
    publishAtomically({ programId, versionId }) {
      return repository.publishVersion(programId, versionId);
    },
  };
  return new PublishProgramUseCase(port);
}
