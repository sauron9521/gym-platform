export type CancelProgramAssignment = {
  assignmentId: string;
  trainerId: string;
  endedAt: Date;
  reason: string | null;
};

/** The conditional cancellation write no longer matches an active assignment. */
export class AssignmentCancellationStateChanged extends Error {
  constructor() {
    super('Assignment state has changed. Reload and try again.');
    this.name = 'AssignmentCancellationStateChanged';
  }
}
