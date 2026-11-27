import { Prisma } from '#prisma/client';
import type { ProgramEventType, ValidatedOutboxEvent } from '../domain/outbox-event.policy.js';
import {
  programEventStatus,
  programNotificationSourceWhere,
} from '../domain/program-notification.policy.js';

type Event = Extract<ValidatedOutboxEvent, { type: ProgramEventType }>;

export async function resolveProgramNotification(tx: Prisma.TransactionClient, event: Event) {
  const id = event.payload.aggregate.id;
  const pointer = await tx.trainingProgramAssignment.findUnique({
    where: { id },
    select: { trainerAthleteId: true },
  });
  if (!pointer) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  // Match assignment mutations: relationship before assignment. Never
  // hold a provider call or external I/O within these locks.
  const relation = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM trainer_athletes WHERE id = ${pointer.trainerAthleteId} FOR SHARE`;
  if (!relation.length) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM training_program_assignments WHERE id = ${id} AND trainer_athlete_id = ${pointer.trainerAthleteId} FOR SHARE`;
  if (!rows.length) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const source = await tx.trainingProgramAssignment.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      athleteId: true,
      assignedById: true,
      assignedAt: true,
      completedAt: true,
      endedById: true,
      endedAt: true,
      trainerAthlete: { select: { trainerId: true, athleteId: true } },
      version: { select: { program: { select: { trainerId: true } } } },
    },
  });
  if (source.status !== programEventStatus(event.type))
    return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const { athleteId, assignedById } = source;
  if (
    athleteId === assignedById ||
    source.trainerAthlete.athleteId !== athleteId ||
    source.trainerAthlete.trainerId !== assignedById ||
    source.version.program.trainerId !== assignedById
  ) {
    return { result: 'dead_letter', code: 'SOURCE_MISMATCH' } as const;
  }
  const actor =
    event.type === 'program.assigned'
      ? assignedById
      : event.type === 'program.assignment.completed'
        ? athleteId
        : source.endedById;
  const at =
    event.type === 'program.assigned'
      ? source.assignedAt
      : event.type === 'program.assignment.completed'
        ? source.completedAt
        : source.endedAt;
  if (
    !actor ||
    actor !== event.actorUserId ||
    at?.getTime() !== event.occurredAt.getTime() ||
    ![athleteId, assignedById].includes(actor) ||
    (event.type === 'program.assignment.cancelled' && actor !== assignedById)
  ) {
    return { result: 'dead_letter', code: 'SOURCE_MISMATCH' } as const;
  }
  await tx.$queryRaw`SELECT id FROM users WHERE id IN (${Prisma.join([athleteId, assignedById].sort())}) ORDER BY id FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM trainer_profiles WHERE user_id = ${assignedById} FOR SHARE`;
  const eligible = await tx.trainingProgramAssignment.findFirst({
    where: { id, ...programNotificationSourceWhere(event.type, athleteId) },
    select: { id: true },
  });
  if (!eligible) return { result: 'skipped', code: 'RECIPIENT_INELIGIBLE' } as const;
  return { result: 'resolved', recipientId: athleteId, programAssignmentId: id } as const;
}
