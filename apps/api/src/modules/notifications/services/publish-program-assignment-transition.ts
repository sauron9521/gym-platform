import type { Prisma, TrainingProgramAssignmentStatus } from '#prisma/client';
import { publishOutboxEvent } from './publish-outbox-event.js';

type AssignmentTransition = {
  id: string;
  status: TrainingProgramAssignmentStatus;
  athleteId: string;
  assignedById: string;
  assignedAt: Date;
  completedAt: Date | null;
  endedAt: Date | null;
  endedById: string | null;
};

/** The caller must pass a row returned by the successful source mutation,
 * inside that mutation's transaction. No client-supplied routing payload. */
export async function publishProgramAssignmentTransition(
  tx: Prisma.TransactionClient,
  row: AssignmentTransition,
) {
  const transitions = {
    ACTIVE: ['program.assigned', row.assignedById, row.assignedAt],
    CANCELLED: ['program.assignment.cancelled', row.endedById, row.endedAt],
    TERMINATED: ['program.assignment.terminated', row.endedById, row.endedAt],
    COMPLETED: ['program.assignment.completed', row.athleteId, row.completedAt],
  } as const;
  const [type, actorUserId, occurredAt] = transitions[row.status];
  if (!actorUserId || !occurredAt || ![row.athleteId, row.assignedById].includes(actorUserId)) {
    throw new Error('Invalid assignment transition');
  }
  await publishOutboxEvent(tx, {
    type,
    schemaVersion: 1,
    actorUserId,
    occurredAt,
    payload: { aggregate: { kind: 'TrainingProgramAssignment', id: row.id } },
  });
}
