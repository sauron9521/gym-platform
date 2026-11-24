const messages = {
  ALREADY_EXISTS: 'This program assignment already exists.',
  STATE_CHANGED: 'The program or relationship state has changed.',
  REFERENCE_MISSING: 'One of the assignment references no longer exists.',
} as const;

export type AssignmentCreationErrorCode = keyof typeof messages;

export class AssignmentCreationError extends Error {
  constructor(readonly code: AssignmentCreationErrorCode) {
    super(messages[code]);
    this.name = 'AssignmentCreationError';
  }
}

export type CreateProgramAssignment = {
  programId: string;
  versionId: string;
  trainerAthleteId: string;
  trainerId: string;
  athleteId: string;
};
