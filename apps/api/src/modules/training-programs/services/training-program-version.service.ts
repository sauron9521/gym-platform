import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '#prisma/client';

import { TrainingProgramVersionRepository } from '../repositories/training-program-version.repository.js';
import type { PublishProgramUseCase } from '../application/publish-program.use-case.js';
import { isWorkoutOutsideDuration } from '../domain/duration.policy.js';
import {
  DraftVersionStateChanged,
  normalizeDraftVersionChanges,
} from '../application/draft-version-update.js';
import { rethrowPublicationHttpError } from '../policies/training-program-publication.policy.js';
import { PUBLISH_PROGRAM_USE_CASE } from '../publication.provider.js';
import type { TrainingProgramVersionPayload } from '../types/training-program-payload.types.js';
import { TrainingProgramCrudService } from './training-program-crud.service.js';

import type {
  PublishedTrainingProgramVersionsQuery,
  TrainingProgramActor,
  UpdateTrainingProgramDraftInput,
} from '../types/training-program.types.js';

@Injectable()
export class TrainingProgramVersionService {
  constructor(
    private readonly repository: TrainingProgramVersionRepository,
    private readonly crudService: TrainingProgramCrudService,
    @Inject(PUBLISH_PROGRAM_USE_CASE)
    private readonly publication: PublishProgramUseCase<TrainingProgramVersionPayload>,
  ) {}

  // ===========================================================================
  // FIND VERSIONS
  // ===========================================================================
  async findVersions(programId: string, actor: TrainingProgramActor) {
    await this.crudService.findOne(programId, actor);

    return this.repository.findVersions(programId);
  }

  async findPublishedVersions(
    programId: string,
    actor: TrainingProgramActor,
    query: PublishedTrainingProgramVersionsQuery,
  ) {
    await this.crudService.findOne(programId, actor);

    const versions = await this.repository.findPublishedVersions(programId, actor.id, query);
    const data = versions.slice(0, query.limit);
    return {
      data,
      nextBeforeVersion: versions.length > query.limit ? data.at(-1)!.version : null,
    };
  }

  // ===========================================================================
  // FIND VERSION DETAILS
  // ===========================================================================
  async findVersion(programId: string, versionId: string, actor: TrainingProgramActor) {
    await this.crudService.findOne(programId, actor);

    const version = await this.repository.findVersionById(versionId, {
      programId,
    });

    if (!version) {
      throw new NotFoundException('Training program version not found');
    }

    return version;
  }

  // ===========================================================================
  // CREATE NEXT DRAFT
  // ===========================================================================
  async createNextDraft(programId: string, actor: TrainingProgramActor) {
    const program = await this.crudService.findOne(programId, actor);

    if (program.status === 'ARCHIVED') {
      throw new ConflictException('An archived program cannot be edited');
    }

    const existingDraft = await this.repository.findDraftVersion(programId);

    if (existingDraft) {
      throw new ConflictException('This program already has a draft version');
    }

    let draft: Awaited<
      ReturnType<TrainingProgramVersionRepository['createDraftFromLatestPublished']>
    >;

    try {
      draft = await this.repository.createDraftFromLatestPublished(programId);
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('A draft version already exists or was created concurrently');
      }

      throw error;
    }

    if (!draft) {
      throw new ConflictException('No published version is available to create a new draft');
    }

    return draft;
  }

  // ===========================================================================
  // UPDATE DRAFT VERSION
  // ===========================================================================
  async updateDraftVersion(
    programId: string,
    versionId: string,
    actor: TrainingProgramActor,
    input: UpdateTrainingProgramDraftInput,
  ) {
    const program = await this.crudService.findOne(programId, actor);

    if (program.status === 'ARCHIVED') {
      throw new ConflictException('An archived program cannot be edited');
    }

    const version = await this.findVersion(programId, versionId, actor);

    if (version.status !== 'DRAFT') {
      throw new ConflictException('Published versions are immutable');
    }

    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    // Fast feedback for the client; the repository repeats this under a row
    // lock to protect against concurrent workout edits.
    const requestedWeeks = input.durationWeeks;
    if (
      typeof requestedWeeks === 'number' &&
      version.workouts.some((workout) =>
        isWorkoutOutsideDuration(workout.weekNumber, requestedWeeks),
      )
    ) {
      throw new BadRequestException('A workout week cannot exceed the program duration');
    }

    const changes = normalizeDraftVersionChanges(input);

    try {
      return await this.repository.updateDraftVersion(programId, versionId, changes);
    } catch (error) {
      if (error instanceof DraftVersionStateChanged) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  // ===========================================================================
  // PUBLISH VERSION
  // ===========================================================================
  async publishVersion(programId: string, versionId: string, actor: TrainingProgramActor) {
    try {
      return await this.publication.execute({ programId, versionId, actor });
    } catch (error) {
      return rethrowPublicationHttpError(error);
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
