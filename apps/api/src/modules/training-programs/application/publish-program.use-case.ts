import { assertPublishableVersion } from '../domain/publication.policy.js';
import type { PublishProgramCommand, PublishProgramPort } from './ports/publish-program.port.js';

const conflictMessages = {
  ARCHIVED_PROGRAM: 'An archived program cannot be published',
  NON_DRAFT_VERSION: 'Only draft versions can be published',
  STALE_VERSION: 'Version state has changed. Reload and try again.',
} as const;

export class PublicationConflict extends Error {
  constructor(readonly code: keyof typeof conflictMessages) {
    super(conflictMessages[code]);
    this.name = 'PublicationConflict';
  }
}

export class PublishProgramUseCase<Result> {
  constructor(private readonly port: PublishProgramPort<Result>) {}

  async execute(command: PublishProgramCommand): Promise<Result> {
    const status = await this.port.loadOwnedProgramStatus(command);
    if (status === 'ARCHIVED') {
      throw new PublicationConflict('ARCHIVED_PROGRAM');
    }

    const version = await this.port.loadOwnedVersion(command);
    if (version.status !== 'DRAFT') {
      throw new PublicationConflict('NON_DRAFT_VERSION');
    }

    assertPublishableVersion(version);

    // The adapter must repeat validation against locked authoritative data.
    const published = await this.port.publishAtomically(command);
    if (published === null) {
      throw new PublicationConflict('STALE_VERSION');
    }

    return published;
  }
}
