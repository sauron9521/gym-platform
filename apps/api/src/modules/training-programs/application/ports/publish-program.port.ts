import type { PublishableVersion } from '../../domain/publication.policy.js';

type PublicationActor = {
  id: string;
  role: 'ATHLETE' | 'TRAINER' | 'ADMIN';
};

export type PublishProgramCommand = {
  programId: string;
  versionId: string;
  actor: PublicationActor;
};

type PublicationProgramStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PublicationDraft = PublishableVersion & { status: 'DRAFT' | 'PUBLISHED' };

/**
 * The result is opaque to the use case: the outer adapter supplies the existing
 * read projection without copying or converting Decimal/date values.
 */
export interface PublishProgramPort<Result> {
  loadOwnedProgramStatus(command: PublishProgramCommand): Promise<PublicationProgramStatus>;
  loadOwnedVersion(command: PublishProgramCommand): Promise<PublicationDraft>;
  publishAtomically(command: PublishProgramCommand): Promise<Result | null>;
}
