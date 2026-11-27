import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { TrainingProgramAssignmentRepository } from '../../../src/modules/training-programs/repositories/training-program-assignment.repository.js';
import { TrainerAthleteTerminationService } from '../../../src/modules/trainer-athletes/services/trainer-athlete-termination.service.js';
import { TrainerAthleteExerciseCopyService } from '../../../src/modules/trainer-athletes/services/trainer-athlete-exercise-copy.service.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { NotificationInboxRepository } from '../../../src/modules/notifications/repositories/notification-inbox.repository.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Program assignment notification transitions (PostgreSQL)', () => {
  const trainerId = randomUUID();
  const athleteId = randomUUID();
  const stranger = randomUUID();
  const old = new Date('1999-01-01T00:00:00.000Z');
  let prisma: PrismaService;
  let assignments: TrainingProgramAssignmentRepository;
  let dispatcher: OutboxDispatchRepository;
  let inbox: NotificationInboxRepository;
  let termination: TrainerAthleteTerminationService;
  let programId: string;
  let versionId: string;
  let trainerAthleteId: string;

  beforeAll(async () => {
    useTestDatabase();
    prisma = new PrismaService(
      new ConfigService<AppEnv, true>({ DATABASE_URL: process.env.DATABASE_URL! }),
    );
    await prisma.onModuleInit();
    assignments = new TrainingProgramAssignmentRepository(prisma);
    dispatcher = new OutboxDispatchRepository(prisma);
    inbox = new NotificationInboxRepository(prisma);
    termination = new TrainerAthleteTerminationService(
      prisma,
      new TrainerAthleteExerciseCopyService(),
    );
    await prisma.user.createMany({
      data: [trainerId, athleteId, stranger].map((id) => ({
        id,
        email: id + '@example.test',
        passwordHash: 'test-only',
        emailVerified: true,
        role: id === trainerId ? 'TRAINER' : 'ATHLETE',
      })),
    });
    const program = await prisma.trainingProgram.create({
      data: {
        trainerId,
        status: 'PUBLISHED',
        versions: {
          create: {
            version: 1,
            title: 'Private program',
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        },
      },
      include: { versions: true },
    });
    programId = program.id;
    versionId = program.versions[0]!.id;
  });

  async function cleanup() {
    await prisma.notification.deleteMany({
      where: { recipientId: { in: [trainerId, athleteId, stranger] } },
    });
    await prisma.outboxEvent.deleteMany({ where: { actorUserId: { in: [trainerId, athleteId] } } });
    await prisma.trainingProgramAssignment.deleteMany({ where: { athleteId } });
    await prisma.trainerAthlete.deleteMany({ where: { trainerId } });
    await prisma.trainerProfile.deleteMany({ where: { userId: trainerId } });
  }
  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.trainingProgramVersion.deleteMany({ where: { programId } });
        await prisma.trainingProgram.deleteMany({ where: { trainerId } });
        await prisma.user.deleteMany({ where: { id: { in: [trainerId, athleteId, stranger] } } });
      }
    } finally {
      await prisma?.onApplicationShutdown();
    }
  });

  async function relation() {
    const row = await prisma.trainerAthlete.create({
      data: {
        trainerId,
        athleteId,
        initiatedById: trainerId,
        status: 'ACTIVE',
        respondedAt: new Date(),
      },
    });
    trainerAthleteId = row.id;
  }
  const create = () =>
    assignments.createAssignmentForActiveRelationship({
      programId,
      versionId,
      trainerAthleteId,
      trainerId,
      athleteId,
    });
  const key = (id: string, type: string) => 'program-assignment:' + id + ':' + type + ':v1';

  async function dispatch(id: string, type: string, expected = 'processed') {
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: { eventKey: key(id, type) },
    });
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: old } });
    const claim = await dispatcher.claim();
    expect(claim?.id).toBe(event.id);
    expect(await dispatcher.process(claim!)).toBe(expected);
    return event;
  }

  async function assertOnly(id: string, type: string) {
    const rows = (await inbox.list(athleteId, { category: 'PROGRAM' })).data;
    expect(rows).toEqual([
      {
        id: expect.any(String),
        type,
        category: 'PROGRAM',
        templateKey: type,
        createdAt: expect.any(Date),
        readAt: null,
        target: { kind: 'PROGRAM_ASSIGNMENT', id },
      },
    ]);
    expect((await inbox.list(trainerId, { category: 'PROGRAM' })).data).toEqual([]);
    await expect(inbox.detail(stranger, rows[0]!.id)).rejects.toThrow('Notification not found');
    await expect(inbox.markRead(stranger, rows[0]!.id)).rejects.toThrow('Notification not found');
    return rows[0]!;
  }

  it('publishes only one assignment for concurrent creation and projects its authorized target', async () => {
    await relation();
    const results = await Promise.allSettled([create(), create()]);
    const winner = results.find((r) => r.status === 'fulfilled');
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    if (winner?.status !== 'fulfilled' || !winner.value) throw new Error('Missing assignment');
    const row = winner.value;
    const event = await dispatch(row.id, 'program.assigned');
    expect(event.payload).toEqual({ aggregate: { kind: 'TrainingProgramAssignment', id: row.id } });
    expect(await prisma.outboxEvent.count({ where: { actorUserId: trainerId } })).toBe(1);
    await assertOnly(row.id, 'program.assigned');
  });

  it('cancellation supersedes assignment and rejects repeated or unauthorized transitions', async () => {
    await relation();
    const row = (await create())!;
    await dispatch(row.id, 'program.assigned');
    const initial = await assertOnly(row.id, 'program.assigned');
    const command = {
      assignmentId: row.id,
      trainerId,
      endedAt: new Date(),
      reason: 'private reason',
    };
    expect(
      await assignments.cancelAssignmentIfTrainerEligible({ ...command, trainerId: stranger }),
    ).toBeNull();
    expect(await assignments.cancelAssignmentIfTrainerEligible(command)).not.toBeNull();
    expect(await assignments.cancelAssignmentIfTrainerEligible(command)).toBeNull();
    await dispatch(row.id, 'program.assignment.cancelled');
    await assertOnly(row.id, 'program.assignment.cancelled');
    await expect(inbox.detail(athleteId, initial.id)).rejects.toThrow('Notification not found');
    expect(await prisma.outboxEvent.count({ where: { actorUserId: trainerId } })).toBe(2);
  });

  it('rolls back cancellation when outbox key conflicts', async () => {
    await relation();
    const row = (await create())!;
    const endedAt = new Date();
    await prisma.outboxEvent.create({
      data: {
        eventKey: key(row.id, 'program.assignment.cancelled'),
        type: 'program.assignment.cancelled',
        schemaVersion: 1,
        actorUserId: trainerId,
        occurredAt: old,
        payload: { aggregate: { kind: 'TrainingProgramAssignment', id: row.id } },
      },
    });
    await expect(
      assignments.cancelAssignmentIfTrainerEligible({
        assignmentId: row.id,
        trainerId,
        endedAt,
        reason: null,
      }),
    ).rejects.toThrow('Outbox event key conflict');
    expect(
      (await prisma.trainingProgramAssignment.findUniqueOrThrow({ where: { id: row.id } })).status,
    ).toBe('ACTIVE');
  });

  it('completion is a single athlete-owned receipt and stale assignment is skipped', async () => {
    await relation();
    const row = (await create())!;
    expect(
      (
        await assignments.completeAssignmentIfNoUnfinishedWorkouts({
          assignmentId: row.id,
          athleteId: stranger,
          completedAt: new Date(),
        })
      ).status,
    ).toBe('NOT_ACTIVE');
    const command = { assignmentId: row.id, athleteId, completedAt: new Date() };
    expect((await assignments.completeAssignmentIfNoUnfinishedWorkouts(command)).status).toBe(
      'COMPLETED',
    );
    expect((await assignments.completeAssignmentIfNoUnfinishedWorkouts(command)).status).toBe(
      'NOT_ACTIVE',
    );
    await dispatch(row.id, 'program.assigned', 'skipped');
    await dispatch(row.id, 'program.assignment.completed');
    await assertOnly(row.id, 'program.assignment.completed');
  });

  it('revocation hides an active assignment notice for count, detail and mark-read', async () => {
    await relation();
    const row = (await create())!;
    await dispatch(row.id, 'program.assigned');
    const initial = await assertOnly(row.id, 'program.assigned');
    await prisma.trainerProfile.create({ data: { userId: trainerId, isActive: false } });
    expect(await inbox.unreadCount(athleteId)).toEqual({ count: 0 });
    await expect(inbox.detail(athleteId, initial.id)).rejects.toThrow('Notification not found');
    await expect(inbox.markRead(athleteId, initial.id)).rejects.toThrow('Notification not found');
    await inbox.markAllRead(athleteId);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: initial.id } })).readAt,
    ).toBeNull();
  });

  it('terminates active assignments atomically with relationship and rolls back on copy failure', async () => {
    await relation();
    const row = (await create())!;
    const command = { id: trainerAthleteId, actorId: athleteId, redactForTrainer: false };
    const failure = new TrainerAthleteTerminationService(prisma, {
      copyRelevantExercises: async () => {
        throw new Error('copy failure');
      },
    } as unknown as TrainerAthleteExerciseCopyService);
    await expect(failure.terminateWithExerciseCopies(command)).rejects.toThrow('copy failure');
    expect(
      (await prisma.trainingProgramAssignment.findUniqueOrThrow({ where: { id: row.id } })).status,
    ).toBe('ACTIVE');
    expect(
      await prisma.outboxEvent.findUnique({
        where: { eventKey: key(row.id, 'program.assignment.terminated') },
      }),
    ).toBeNull();
    await termination.terminateWithExerciseCopies(command);
    await dispatch(row.id, 'program.assigned', 'skipped');
    await dispatch(row.id, 'program.assignment.terminated');
    await assertOnly(row.id, 'program.assignment.terminated');
    expect((await termination.terminateWithExerciseCopies(command)).status).toBe('STATE_CHANGED');
  });
});
