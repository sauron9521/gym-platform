import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { TrainerAthletesRepository } from '../../../src/modules/trainer-athletes/repositories/trainer-athletes.repository.js';
import { TrainerAthleteTerminationService } from '../../../src/modules/trainer-athletes/services/trainer-athlete-termination.service.js';
import { TrainerAthleteExerciseCopyService } from '../../../src/modules/trainer-athletes/services/trainer-athlete-exercise-copy.service.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { NotificationInboxRepository } from '../../../src/modules/notifications/repositories/notification-inbox.repository.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Trainer relationship notification transitions (PostgreSQL)', () => {
  const trainerId = randomUUID();
  const athleteId = randomUUID();
  const stranger = randomUUID();
  const old = new Date('2000-01-01T00:00:00.000Z');
  let prisma: PrismaService;
  let relationships: TrainerAthletesRepository;
  let dispatcher: OutboxDispatchRepository;
  let inbox: NotificationInboxRepository;
  let termination: TrainerAthleteTerminationService;

  beforeAll(async () => {
    useTestDatabase();
    prisma = new PrismaService(
      new ConfigService<AppEnv, true>({ DATABASE_URL: process.env.DATABASE_URL! }),
    );
    await prisma.onModuleInit();
    relationships = new TrainerAthletesRepository(prisma);
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
      })),
    });
    await prisma.trainerProfile.create({
      data: { userId: trainerId, isActive: true, approvedAt: new Date(), approvedById: stranger },
    });
  });

  async function cleanup() {
    await prisma.notification.deleteMany({
      where: { recipientId: { in: [trainerId, athleteId, stranger] } },
    });
    await prisma.outboxEvent.deleteMany({ where: { actorUserId: { in: [trainerId, athleteId] } } });
    await prisma.trainerAthlete.deleteMany({ where: { trainerId } });
    await prisma.trainerProfile.updateMany({
      where: { userId: trainerId },
      data: { isActive: true },
    });
  }

  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.trainerProfile.deleteMany({ where: { userId: trainerId } });
        await prisma.user.deleteMany({ where: { id: { in: [trainerId, athleteId, stranger] } } });
      }
    } finally {
      await prisma?.onApplicationShutdown();
    }
  });

  const create = (initiatedById = trainerId) =>
    relationships.createWithCurrentCapabilities({ trainerId, athleteId, initiatedById });

  async function dispatch(id: string, type: string, expected = 'processed') {
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: { eventKey: 'trainer-relationship:' + id + ':' + type + ':v1' },
    });
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: old } });
    const claim = await dispatcher.claim();
    expect(claim?.id).toBe(event.id);
    expect(await dispatcher.process(claim!)).toBe(expected);
    return event;
  }

  async function assertOnly(recipientId: string, type: string, relationId?: string) {
    const data = (await inbox.list(recipientId, {})).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      id: expect.any(String),
      type,
      category: 'TRAINER',
      templateKey: type,
      createdAt: expect.any(Date),
      readAt: null,
      ...(relationId ? { target: { kind: 'TRAINER_RELATIONSHIP', id: relationId } } : {}),
    });
    const other = recipientId === trainerId ? athleteId : trainerId;
    expect(await inbox.unreadCount(other)).toEqual({ count: 0 });
    await expect(inbox.detail(stranger, data[0]!.id)).rejects.toThrow('Notification not found');
    await expect(inbox.markRead(stranger, data[0]!.id)).rejects.toThrow('Notification not found');
    return data[0]!;
  }

  it.each([true, false])(
    'routes creation and acceptance to the counterpart (trainer initiated=%s)',
    async (trainerInitiated) => {
      const initiator = trainerInitiated ? trainerId : athleteId;
      const invited = trainerInitiated ? athleteId : trainerId;
      const row = await create(initiator);
      await expect(create(initiator)).rejects.toThrow();
      await dispatch(row.id, 'trainer.invitation.created');
      const invitation = await assertOnly(invited, 'trainer.invitation.created');
      await relationships.acceptPendingInvitation({
        relationshipId: row.id,
        respondedAt: new Date(),
      });
      await expect(
        relationships.acceptPendingInvitation({ relationshipId: row.id, respondedAt: new Date() }),
      ).rejects.toThrow();
      await dispatch(row.id, 'trainer.invitation.accepted');
      await assertOnly(
        initiator,
        'trainer.invitation.accepted',
        trainerInitiated ? row.id : undefined,
      );
      await expect(inbox.detail(invited, invitation.id)).rejects.toThrow('Notification not found');
      expect(
        await prisma.outboxEvent.count({ where: { actorUserId: { in: [trainerId, athleteId] } } }),
      ).toBe(2);
    },
  );

  it.each(['DECLINED', 'CANCELLED'] as const)(
    'routes %s and suppresses stale creation',
    async (status) => {
      const row = await create(athleteId);
      if (status === 'DECLINED') {
        await relationships.closePendingInvitation({
          relationshipId: row.id,
          status,
          respondedAt: new Date(),
          redactForTrainer: true,
        });
      } else {
        await relationships.closePendingInvitation({
          relationshipId: row.id,
          status,
          endedAt: new Date(),
          endedById: athleteId,
          endReason: 'private reason',
          redactForTrainer: false,
        });
      }
      await dispatch(row.id, 'trainer.invitation.created', 'skipped');
      const type =
        status === 'DECLINED' ? 'trainer.invitation.declined' : 'trainer.invitation.cancelled';
      const event = await dispatch(row.id, type);
      expect(event.payload).toEqual({ aggregate: { kind: 'TrainerAthlete', id: row.id } });
      await assertOnly(status === 'DECLINED' ? athleteId : trainerId, type);
    },
  );

  it('hides invitations after trainer revocation, including list/count/detail/read', async () => {
    const row = await create(athleteId);
    await dispatch(row.id, 'trainer.invitation.created');
    const item = await assertOnly(trainerId, 'trainer.invitation.created');
    await prisma.trainerProfile.update({ where: { userId: trainerId }, data: { isActive: false } });
    expect((await inbox.list(trainerId, {})).data).toEqual([]);
    expect(await inbox.unreadCount(trainerId)).toEqual({ count: 0 });
    await expect(inbox.detail(trainerId, item.id)).rejects.toThrow('Notification not found');
    await expect(inbox.markRead(trainerId, item.id)).rejects.toThrow('Notification not found');
    await inbox.markAllRead(trainerId);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).readAt,
    ).toBeNull();
  });

  it('suppresses an invitation when capability is revoked before dispatch', async () => {
    const row = await create();
    await prisma.trainerProfile.update({ where: { userId: trainerId }, data: { isActive: false } });
    await dispatch(row.id, 'trainer.invitation.created', 'skipped');
    expect(await inbox.unreadCount(athleteId)).toEqual({ count: 0 });
  });

  it('rolls back termination and outbox on copy failure, then sends only the termination notice', async () => {
    const row = await create();
    await dispatch(row.id, 'trainer.invitation.created');
    await relationships.acceptPendingInvitation({
      relationshipId: row.id,
      respondedAt: new Date(),
    });
    await dispatch(row.id, 'trainer.invitation.accepted');
    const failure = new TrainerAthleteTerminationService(prisma, {
      copyRelevantExercises: async () => {
        throw new Error('copy failed');
      },
    } as unknown as TrainerAthleteExerciseCopyService);
    await expect(
      failure.terminateWithExerciseCopies({
        id: row.id,
        actorId: trainerId,
        redactForTrainer: true,
      }),
    ).rejects.toThrow('copy failed');
    expect((await prisma.trainerAthlete.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      'ACTIVE',
    );
    expect(
      await prisma.outboxEvent.count({
        where: { type: 'trainer.relationship.terminated', actorUserId: trainerId },
      }),
    ).toBe(0);
    await termination.terminateWithExerciseCopies({
      id: row.id,
      actorId: trainerId,
      reason: 'private',
      redactForTrainer: true,
    });
    const event = await dispatch(row.id, 'trainer.relationship.terminated');
    expect(event.payload).toEqual({ aggregate: { kind: 'TrainerAthlete', id: row.id } });
    await assertOnly(athleteId, 'trainer.relationship.terminated');
  });
});
