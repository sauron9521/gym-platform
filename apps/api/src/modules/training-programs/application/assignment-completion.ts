export type CompleteProgramAssignment = {
  assignmentId: string;
  athleteId: string;
  completedAt: Date;
};

/** Outcomes from the authoritative, locked completion operation. */
export type AssignmentCompletionResult<Result> =
  | { status: 'COMPLETED'; assignment: Result }
  | { status: 'HAS_UNFINISHED_WORKOUTS'; unfinishedCount: number }
  | { status: 'NOT_ACTIVE' };
