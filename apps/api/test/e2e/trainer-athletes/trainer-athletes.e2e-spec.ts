import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { StandardSchemaValidationPipe } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import request from 'supertest';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { TrainerAthletesRepository } from '../../../src/modules/trainer-athletes/repositories/trainer-athletes.repository.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('TrainerAthletes (HTTP + PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasher;

  type TestUser = {
    id: string;
    email: string;
  };

  let trainerOne: TestUser;
  let trainerTwo: TestUser;
  let athleteOne: TestUser;
  let athleteTwo: TestUser;
  let outsider: TestUser;

  let trainerOneCookie: string;
  let trainerTwoCookie: string;
  let athleteOneCookie: string;
  let athleteTwoCookie: string;
  let outsiderCookie: string;

  let trainerInitiatedRelationshipId: string;
  let athleteInitiatedRelationshipId: string;
  let declinedRelationshipId: string;

  const userIds: string[] = [];

  const password = 'StrongPassword123!';

  function extractSessionCookie(header: string | string[] | undefined): string {
    const cookies = Array.isArray(header) ? header : header ? [header] : [];

    const cookie = cookies
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-sid='));

    if (!cookie) {
      throw new Error('Session cookie was not set.');
    }

    return cookie;
  }

  async function login(email: string): Promise<string> {
    const response = await request(app!.getHttpServer()).post('/auth/login').send({
      email,
      password,
    });

    expect(response.status).toBe(200);

    return extractSessionCookie(response.headers['set-cookie']);
  }

  async function createUser(email: string, role: 'TRAINER' | 'ATHLETE'): Promise<TestUser> {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await passwordHasher.hash(password),
        role,
      },
      select: {
        id: true,
        email: true,
      },
    });

    userIds.push(user.id);

    return user;
  }

  beforeAll(async () => {
    // Never allow these tests to connect to the development database.
    useTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(new StandardSchemaValidationPipe());

    await app.init();

    prisma = app.get(PrismaService);
    passwordHasher = app.get(PasswordHasher);

    trainerOne = await createUser(`trainer-one-${randomUUID()}@example.com`, 'TRAINER');

    trainerTwo = await createUser(`trainer-two-${randomUUID()}@example.com`, 'TRAINER');

    athleteOne = await createUser(`athlete-one-${randomUUID()}@example.com`, 'ATHLETE');

    athleteTwo = await createUser(`athlete-two-${randomUUID()}@example.com`, 'ATHLETE');

    outsider = await createUser(`outsider-${randomUUID()}@example.com`, 'ATHLETE');

    trainerOneCookie = await login(trainerOne.email);
    trainerTwoCookie = await login(trainerTwo.email);
    athleteOneCookie = await login(athleteOne.email);
    athleteTwoCookie = await login(athleteTwo.email);
    outsiderCookie = await login(outsider.email);
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && userIds.length > 0) {
        // Remove relationship history before deleting referenced users.
        await prisma.trainerAthlete.deleteMany({
          where: {
            OR: [
              { trainerId: { in: userIds } },
              { athleteId: { in: userIds } },
              { initiatedById: { in: userIds } },
              { endedById: { in: userIds } },
            ],
          },
        });

        await prisma.user.deleteMany({
          where: {
            id: { in: userIds },
          },
        });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('serves scoped dashboard counts without leaking other trainers or ended activity', async () => {
    const relationId = randomUUID();
    const foreignRelationId = randomUUID();
    const programId = randomUUID();
    const foreignProgramId = randomUUID();
    const versionId = randomUUID();
    const foreignVersionId = randomUUID();
    const assignmentId = randomUUID();
    const foreignAssignmentId = randomUUID();
    const now = new Date();

    try {
      await prisma.trainerAthlete.createMany({
        data: [
          {
            id: relationId,
            trainerId: trainerOne.id,
            athleteId: athleteOne.id,
            initiatedById: trainerOne.id,
            status: 'ACTIVE',
          },
          {
            id: foreignRelationId,
            trainerId: trainerTwo.id,
            athleteId: athleteTwo.id,
            initiatedById: trainerTwo.id,
            status: 'ACTIVE',
          },
        ],
      });
      await prisma.trainingProgram.createMany({
        data: [
          { id: programId, trainerId: trainerOne.id, status: 'PUBLISHED' },
          { id: foreignProgramId, trainerId: trainerTwo.id, status: 'PUBLISHED' },
        ],
      });
      await prisma.trainingProgramVersion.createMany({
        data: [
          { id: versionId, programId, version: 1, title: 'Trainer program', status: 'PUBLISHED' },
          {
            id: foreignVersionId,
            programId: foreignProgramId,
            version: 1,
            title: 'Other trainer',
            status: 'PUBLISHED',
          },
        ],
      });
      await prisma.trainingProgramAssignment.createMany({
        data: [
          {
            id: assignmentId,
            versionId,
            trainerAthleteId: relationId,
            athleteId: athleteOne.id,
            assignedById: trainerOne.id,
            status: 'ACTIVE',
          },
          {
            id: foreignAssignmentId,
            versionId: foreignVersionId,
            trainerAthleteId: foreignRelationId,
            athleteId: athleteTwo.id,
            assignedById: trainerTwo.id,
            status: 'ACTIVE',
          },
        ],
      });
      await prisma.workout.createMany({
        data: [
          {
            title: 'Completed own plan',
            athleteId: athleteOne.id,
            createdById: trainerOne.id,
            programAssignmentId: assignmentId,
            status: 'COMPLETED',
            completedAt: new Date(now.getTime() - 86_400_000),
          },
          {
            title: 'Too old for dashboard window',
            athleteId: athleteOne.id,
            createdById: trainerOne.id,
            programAssignmentId: assignmentId,
            status: 'COMPLETED',
            completedAt: new Date(now.getTime() - 32 * 86_400_000),
          },
          {
            title: 'Incomplete workout',
            athleteId: athleteOne.id,
            createdById: trainerOne.id,
            programAssignmentId: assignmentId,
            status: 'PLANNED',
          },
          {
            title: 'Another trainer private workout',
            athleteId: athleteTwo.id,
            createdById: trainerTwo.id,
            programAssignmentId: foreignAssignmentId,
            status: 'COMPLETED',
            completedAt: new Date(now.getTime() - 86_400_000),
          },
        ],
      });

      const me = await request(app!.getHttpServer())
        .get('/trainer-dashboard/overview')
        .set('Cookie', trainerOneCookie);
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({
        activeClients: 1,
        activeProgramAssignments: 1,
        completedProgramWorkouts30d: 1,
      });
      expect(Date.parse(me.body.asOf) - Date.parse(me.body.windowStart)).toBe(30 * 86_400_000);
      expect(JSON.stringify(me.body)).not.toContain(athleteTwo.email);

      const mine = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${relationId}/progress`)
        .set('Cookie', trainerOneCookie);
      expect(mine.status).toBe(200);
      expect(mine.body).toMatchObject({
        activeProgramAssignments: 1,
        completedProgramWorkouts30d: 1,
      });
      expect(Date.parse(mine.body.asOf) - Date.parse(mine.body.windowStart)).toBe(30 * 86_400_000);
      expect(JSON.stringify(mine.body)).not.toContain(athleteOne.email);
      expect(JSON.stringify(mine.body)).not.toContain(athleteTwo.email);

      const foreignClient = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${foreignRelationId}/progress`)
        .set('Cookie', trainerOneCookie);
      expect(foreignClient.status).toBe(404);
      const nonexistentClient = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${randomUUID()}/progress`)
        .set('Cookie', trainerOneCookie);
      expect(nonexistentClient.status).toBe(404);
      const otherTrainerDenied = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${relationId}/progress`)
        .set('Cookie', trainerTwoCookie);
      expect(otherTrainerDenied.status).toBe(404);

      // Only the currently approved trainer can request a DB-scoped client
      // assignment page. Other trainers, athletes and ended relations must
      // not be used to infer another client's programs or counts.
      const ownAssignments = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', trainerOneCookie)
        .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: relationId });
      expect(ownAssignments.status).toBe(200);
      expect(ownAssignments.body.meta).toMatchObject({
        total: 1,
        skip: 0,
        take: 5,
        totalPages: 1,
      });
      expect(ownAssignments.body.data).toHaveLength(1);
      expect(ownAssignments.body.data[0]).toMatchObject({
        id: assignmentId,
        trainerAthleteId: relationId,
        status: 'ACTIVE',
        version: { title: 'Trainer program' },
      });
      expect(ownAssignments.body.data[0]).not.toHaveProperty('workouts');
      expect(JSON.stringify(ownAssignments.body)).not.toContain(athleteTwo.email);

      for (const disallowedId of [foreignRelationId, randomUUID()]) {
        const foreignAssignments = await request(app!.getHttpServer())
          .get('/training-programs/assignments')
          .set('Cookie', trainerOneCookie)
          .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: disallowedId });
        expect(foreignAssignments.status).toBe(404);
        expect(JSON.stringify(foreignAssignments.body)).not.toContain(athleteTwo.email);
      }
      const ownAsOtherTrainer = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', trainerTwoCookie)
        .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: relationId });
      expect(ownAsOtherTrainer.status).toBe(404);
      const athleteFiltered = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', athleteOneCookie)
        .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: relationId });
      expect(athleteFiltered.status).toBe(403);
      const unboundedFiltered = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', trainerOneCookie)
        .query({ page: 1, limit: 5, trainerAthleteId: relationId });
      expect(unboundedFiltered.status).toBe(400);
      const invalidFiltered = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', trainerOneCookie)
        .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: 'invalid-id' });
      expect(invalidFiltered.status).toBe(400);

      const other = await request(app!.getHttpServer())
        .get('/trainer-dashboard/overview')
        .set('Cookie', trainerTwoCookie);
      expect(other.status).toBe(200);
      expect(other.body).toMatchObject({
        activeClients: 1,
        activeProgramAssignments: 1,
        completedProgramWorkouts30d: 1,
      });

      const denied = await request(app!.getHttpServer())
        .get('/trainer-dashboard/overview')
        .set('Cookie', athleteOneCookie);
      expect(denied.status).toBe(403);
      const athleteProgressDenied = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${relationId}/progress`)
        .set('Cookie', athleteOneCookie);
      expect(athleteProgressDenied.status).toBe(403);
      const unauthenticated = await request(app!.getHttpServer()).get(
        '/trainer-dashboard/overview',
      );
      expect(unauthenticated.status).toBe(401);
      const anonymousClient = await request(app!.getHttpServer()).get(
        `/trainer-dashboard/clients/${relationId}/progress`,
      );
      expect(anonymousClient.status).toBe(401);
      const invalidRelation = await request(app!.getHttpServer())
        .get('/trainer-dashboard/clients/not-a-uuid/progress')
        .set('Cookie', trainerOneCookie);
      expect(invalidRelation.status).toBe(400);

      // Existing browser cookie must not confer Trainer rights after role
      // change in the database; the API checks current grants on each read.
      await prisma.user.update({
        where: { id: trainerOne.id },
        data: { role: 'ATHLETE' },
      });
      const revoked = await request(app!.getHttpServer())
        .get('/trainer-dashboard/overview')
        .set('Cookie', trainerOneCookie);
      expect(revoked.status).toBe(403);
      const revokedClient = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${relationId}/progress`)
        .set('Cookie', trainerOneCookie);
      expect(revokedClient.status).toBe(403);
      const revokedFiltered = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', trainerOneCookie)
        .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: relationId });
      expect(revokedFiltered.status).toBe(403);

      // After restoring trainer eligibility, an ended collaboration must
      // still return indistinguishable 404, never its previous counts.
      await prisma.user.update({
        where: { id: trainerOne.id },
        data: { role: 'TRAINER' },
      });
      await prisma.trainerAthlete.update({
        where: { id: relationId },
        data: { status: 'TERMINATED' },
      });
      const endedClient = await request(app!.getHttpServer())
        .get(`/trainer-dashboard/clients/${relationId}/progress`)
        .set('Cookie', trainerOneCookie);
      expect(endedClient.status).toBe(404);
      const endedAssignments = await request(app!.getHttpServer())
        .get('/training-programs/assignments')
        .set('Cookie', trainerOneCookie)
        .query({ page: 1, limit: 5, view: 'summary', trainerAthleteId: relationId });
      expect(endedAssignments.status).toBe(404);
    } finally {
      await prisma.user.update({
        where: { id: trainerOne.id },
        data: { role: 'TRAINER' },
      });
      await prisma.workout.deleteMany({
        where: { programAssignmentId: { in: [assignmentId, foreignAssignmentId] } },
      });
      await prisma.trainingProgramAssignment.deleteMany({
        where: { id: { in: [assignmentId, foreignAssignmentId] } },
      });
      await prisma.trainingProgramVersion.deleteMany({
        where: { id: { in: [versionId, foreignVersionId] } },
      });
      await prisma.trainingProgram.deleteMany({
        where: { id: { in: [programId, foreignProgramId] } },
      });
      await prisma.trainerAthlete.deleteMany({
        where: { id: { in: [relationId, foreignRelationId] } },
      });
    }
  });

  it('paginates only owned trainer collaborations without leaking athlete-side or tenant records', async () => {
    const relationships = await Promise.all([
      prisma.trainerAthlete.create({
        data: {
          trainerId: trainerOne.id,
          athleteId: athleteOne.id,
          initiatedById: trainerOne.id,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
      prisma.trainerAthlete.create({
        data: {
          trainerId: trainerTwo.id,
          athleteId: trainerOne.id,
          initiatedById: trainerTwo.id,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ]);

    try {
      const response = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .query({ page: 1, limit: 1, status: 'ACTIVE', scope: 'trainer' });

      expect(response.status).toBe(200);
      expect(response.body.meta).toMatchObject({ total: 1, take: 1, totalPages: 1 });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        trainerId: trainerOne.id,
        athleteId: athleteOne.id,
        status: 'ACTIVE',
        athlete: { id: athleteOne.id, email: athleteOne.email },
      });
      expect(JSON.stringify(response.body)).not.toContain(trainerTwo.email);

      const athleteDenied = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', athleteOneCookie)
        .query({ status: 'ACTIVE', scope: 'trainer' });
      expect(athleteDenied.status).toBe(403);

      const foreignTrainer = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', trainerTwoCookie)
        .query({ status: 'ACTIVE', scope: 'trainer' });
      expect(foreignTrainer.status).toBe(200);
      expect(foreignTrainer.body.meta.total).toBe(1);
      expect(foreignTrainer.body.data[0].trainerId).toBe(trainerTwo.id);
      expect(JSON.stringify(foreignTrainer.body)).not.toContain(athleteOne.email);
    } finally {
      await prisma.trainerAthlete.deleteMany({
        where: { id: { in: relationships.map((item) => item.id) } },
      });
    }
  });

  it('should hide athlete identity details when athlete initiated and ended collaboration', async () => {
    let relationshipId: string | undefined;

    // createUser() registers users for afterAll cleanup.
    const newAthlete = await createUser(
      `athlete-history-privacy-${randomUUID()}@example.com`,
      'ATHLETE',
    );

    try {
      const athleteCookie = await login(newAthlete.email);

      // Athlete initiated the relationship.
      const relationship = await prisma.trainerAthlete.create({
        data: {
          trainerId: trainerOne.id,
          athleteId: newAthlete.id,
          initiatedById: newAthlete.id,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      relationshipId = relationship.id;

      // Athlete terminates the collaboration.
      const terminateResponse = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${relationship.id}/terminate`)
        .set('Cookie', athleteCookie)
        .send({
          reason: 'Collaboration ended by athlete',
        });

      expect(terminateResponse.status).toBe(200);

      expect(terminateResponse.body).toMatchObject({
        id: relationship.id,
        status: 'TERMINATED',
        initiatedById: newAthlete.id,
        endedById: newAthlete.id,
      });

      // Former trainer reads relationship details.
      const trainerDetails = await request(app!.getHttpServer())
        .get(`/trainer-athletes/${relationship.id}`)
        .set('Cookie', trainerOneCookie);

      expect(trainerDetails.status).toBe(200);

      expect(trainerDetails.body).toMatchObject({
        id: relationship.id,
        status: 'TERMINATED',
        athlete: {
          id: newAthlete.id,
          role: 'ATHLETE',
        },
        initiatedBy: {
          id: newAthlete.id,
          role: 'ATHLETE',
        },
        endedBy: {
          id: newAthlete.id,
          role: 'ATHLETE',
        },
      });

      // None of the nested user objects may expose email.
      expect(trainerDetails.body.athlete).not.toHaveProperty('email');
      expect(trainerDetails.body.initiatedBy).not.toHaveProperty('email');
      expect(trainerDetails.body.endedBy).not.toHaveProperty('email');

      expect(JSON.stringify(trainerDetails.body)).not.toContain(newAthlete.email);

      // Verify historical list response as well.
      const trainerList = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .query({
          status: 'TERMINATED',
          page: 1,
          limit: 100,
        });

      expect(trainerList.status).toBe(200);

      const historicalItem = trainerList.body.data.find(
        (item: { id: string }) => item.id === relationship.id,
      );

      expect(historicalItem).toBeDefined();

      expect(historicalItem).toMatchObject({
        id: relationship.id,
        status: 'TERMINATED',
      });

      expect(JSON.stringify(historicalItem)).not.toContain(newAthlete.email);

      // Athlete retains full access to their own relationship history.
      const athleteDetails = await request(app!.getHttpServer())
        .get(`/trainer-athletes/${relationship.id}`)
        .set('Cookie', athleteCookie);

      expect(athleteDetails.status).toBe(200);

      expect(athleteDetails.body).toMatchObject({
        athlete: {
          id: newAthlete.id,
          email: newAthlete.email,
        },
        initiatedBy: {
          id: newAthlete.id,
          email: newAthlete.email,
        },
        endedBy: {
          id: newAthlete.id,
          email: newAthlete.email,
        },
      });
    } finally {
      if (relationshipId) {
        await prisma.trainerAthlete.deleteMany({
          where: { id: relationshipId },
        });
      }
    }
  }, 20_000);

  it.each([
    { status: 'DECLINED', action: 'decline' },
    { status: 'CANCELLED', action: 'cancel' },
  ])(
    'redacts $status relationship history for its former trainer',
    async ({ status, action }) => {
      const athlete = await createUser(
        'closed-history-' + randomUUID() + '@example.com',
        'ATHLETE',
      );
      const cookie = await login(athlete.email);
      const secretName = 'PRIVATE_PROFILE_' + randomUUID();
      let relationshipId: string | undefined;

      try {
        await prisma.profile.create({
          data: {
            userId: athlete.id,
            displayName: secretName,
            firstName: secretName,
            timezone: 'Europe/Kyiv',
          },
        });
        const relationship = await prisma.trainerAthlete.create({
          data: {
            trainerId: trainerOne.id,
            athleteId: athlete.id,
            initiatedById: trainerOne.id,
            status: 'PENDING',
          },
          select: { id: true },
        });
        relationshipId = relationship.id;

        const actorCookie = action === 'decline' ? cookie : trainerOneCookie;
        const result = await request(app!.getHttpServer())
          .post('/trainer-athletes/' + relationship.id + '/' + action)
          .set('Cookie', actorCookie)
          .send(action === 'cancel' ? { reason: 'Invitation withdrawn' } : {});

        expect(result.status).toBe(200);
        expect(result.body.status).toBe(status);
        if (action === 'cancel') {
          // A trainer must not receive athlete contact data in the mutation response.
          expect(JSON.stringify(result.body)).not.toContain(athlete.email);
        }

        const [trainerDetails, trainerList, athleteDetails, outsiderDetails] = await Promise.all([
          request(app!.getHttpServer())
            .get('/trainer-athletes/' + relationship.id)
            .set('Cookie', trainerOneCookie),
          request(app!.getHttpServer())
            .get('/trainer-athletes')
            .set('Cookie', trainerOneCookie)
            .query({ status, page: 1, limit: 100 }),
          request(app!.getHttpServer())
            .get('/trainer-athletes/' + relationship.id)
            .set('Cookie', cookie),
          request(app!.getHttpServer())
            .get('/trainer-athletes/' + relationship.id)
            .set('Cookie', outsiderCookie),
        ]);

        expect(trainerDetails.status).toBe(200);
        expect(trainerList.status).toBe(200);
        expect(athleteDetails.status).toBe(200);
        expect(outsiderDetails.status).toBe(404);

        const historicalItem = trainerList.body.data.find(
          (item: { id: string }) => item.id === relationship.id,
        );
        expect(historicalItem).toBeDefined();

        for (const payload of [trainerDetails.body, historicalItem]) {
          expect(payload).toMatchObject({
            id: relationship.id,
            status,
            athlete: { id: athlete.id, role: 'ATHLETE' },
          });
          const json = JSON.stringify(payload);
          expect(json).not.toContain(athlete.email);
          expect(json).not.toContain(secretName);
          expect(payload.athlete).not.toHaveProperty('email');
          expect(payload.athlete).not.toHaveProperty('profile');
          expect(payload.athlete).not.toHaveProperty('passwordHash');
          expect(payload.athlete).not.toHaveProperty('avatarKey');
        }

        // The athlete keeps access to their own relationship history.
        expect(athleteDetails.body.athlete.email).toBe(athlete.email);
      } finally {
        if (relationshipId) {
          await prisma.trainerAthlete.deleteMany({ where: { id: relationshipId } });
        }
        await prisma.profile.deleteMany({ where: { userId: athlete.id } });
      }
    },
    30_000,
  );

  it('keeps an old terminated relationship private after a new collaboration starts', async () => {
    const athlete = await createUser(
      'reconnected-history-' + randomUUID() + '@example.com',
      'ATHLETE',
    );
    const athleteCookie = await login(athlete.email);
    const ids: string[] = [];

    try {
      const first = await prisma.trainerAthlete.create({
        data: {
          trainerId: trainerOne.id,
          athleteId: athlete.id,
          initiatedById: trainerOne.id,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      ids.push(first.id);

      const ended = await request(app!.getHttpServer())
        .post('/trainer-athletes/' + first.id + '/terminate')
        .set('Cookie', trainerOneCookie)
        .send({ reason: 'Old collaboration ended' });
      expect(ended.status).toBe(200);
      expect(ended.body.status).toBe('TERMINATED');
      expect(JSON.stringify(ended.body)).not.toContain(athlete.email);

      const invited = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .send({ userId: athlete.id });
      expect(invited.status).toBe(201);
      ids.push(invited.body.id);

      const accepted = await request(app!.getHttpServer())
        .post('/trainer-athletes/' + invited.body.id + '/accept')
        .set('Cookie', athleteCookie);
      expect(accepted.status).toBe(200);
      expect(accepted.body.status).toBe('ACTIVE');

      const [oldDetails, newDetails, trainerHistory, outsider] = await Promise.all([
        request(app!.getHttpServer())
          .get('/trainer-athletes/' + first.id)
          .set('Cookie', trainerOneCookie),
        request(app!.getHttpServer())
          .get('/trainer-athletes/' + invited.body.id)
          .set('Cookie', trainerOneCookie),
        request(app!.getHttpServer())
          .get('/trainer-athletes')
          .set('Cookie', trainerOneCookie)
          .query({ page: 1, limit: 100 }),
        request(app!.getHttpServer())
          .get('/trainer-athletes/' + first.id)
          .set('Cookie', trainerTwoCookie),
      ]);

      expect(oldDetails.status).toBe(200);
      expect(newDetails.status).toBe(200);
      expect(trainerHistory.status).toBe(200);
      expect(outsider.status).toBe(404);

      const oldItem = trainerHistory.body.data.find((item: { id: string }) => item.id === first.id);
      const newItem = trainerHistory.body.data.find(
        (item: { id: string }) => item.id === invited.body.id,
      );
      expect(oldItem).toBeDefined();
      expect(newItem).toBeDefined();
      for (const payload of [oldDetails.body, oldItem]) {
        expect(payload.status).toBe('TERMINATED');
        expect(JSON.stringify(payload)).not.toContain(athlete.email);
        expect(payload.athlete).not.toHaveProperty('email');
      }
      for (const payload of [newDetails.body, newItem]) {
        expect(payload.status).toBe('ACTIVE');
        expect(payload.athlete.email).toBe(athlete.email);
        expect(payload.athlete).not.toHaveProperty('passwordHash');
      }
    } finally {
      await prisma.trainerAthlete.deleteMany({ where: { id: { in: ids } } });
    }
  }, 30_000);

  describe('Authentication and validation', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app!.getHttpServer()).get('/trainer-athletes');

      expect(response.status).toBe(401);
    });

    it('should reject an invalid relationship UUID', async () => {
      const response = await request(app!.getHttpServer())
        .get('/trainer-athletes/not-a-valid-uuid')
        .set('Cookie', trainerOneCookie);

      expect(response.status).toBe(400);
    });

    it('should reject unexpected fields when creating a relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .send({
          userId: athleteOne.id,
          trainerId: trainerTwo.id,
          status: 'ACTIVE',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /trainer-athletes', () => {
    it('rejects an invitation when trainer approval is revoked after preflight', async () => {
      const approved = await createUser(
        `invite-race-trainer-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const athlete = await createUser(
        `invite-race-athlete-${randomUUID()}@example.com`,
        'ATHLETE',
      );

      await prisma.trainerProfile.create({
        data: {
          userId: approved.id,
          isActive: true,
          approvedAt: new Date(),
          approvedById: trainerOne.id,
        },
      });

      const cookie = await login(approved.email);
      const repository = app!.get(TrainerAthletesRepository);
      const createWithLocks = repository.createWithCurrentCapabilities.bind(repository);
      let intercepted = 0;

      // The service has already read approval when it reaches the repository.
      // Revoke it at exactly this boundary, before the locked DB transaction.
      const spy = vi
        .spyOn(repository, 'createWithCurrentCapabilities')
        .mockImplementation(async (input) => {
          intercepted += 1;
          await prisma.trainerProfile.update({
            where: { userId: approved.id },
            data: { isActive: false, revokedAt: new Date(), revokedById: trainerOne.id },
          });
          return createWithLocks(input);
        });

      try {
        const response = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', cookie)
          .send({ userId: athlete.id });

        expect(response.status).toBe(409);
        expect(intercepted).toBe(1);
        expect(response.body.message).toBe('Relationship participants are no longer eligible');

        const unauthorizedRows = await prisma.trainerAthlete.count({
          where: { trainerId: approved.id, athleteId: athlete.id },
        });
        expect(unauthorizedRows).toBe(0);
      } finally {
        spy.mockRestore();
        await prisma.trainerProfile.deleteMany({ where: { userId: approved.id } });
      }
    }, 25_000);

    it('rejects an invitation when the target trainer is revoked after preflight', async () => {
      const approved = await createUser(
        `invite-target-trainer-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const athlete = await createUser(
        `invite-target-athlete-${randomUUID()}@example.com`,
        'ATHLETE',
      );

      await prisma.trainerProfile.create({
        data: {
          userId: approved.id,
          isActive: true,
          approvedAt: new Date(),
          approvedById: trainerOne.id,
        },
      });

      const cookie = await login(athlete.email);
      const repository = app!.get(TrainerAthletesRepository);
      const createWithLocks = repository.createWithCurrentCapabilities.bind(repository);
      const spy = vi
        .spyOn(repository, 'createWithCurrentCapabilities')
        .mockImplementation(async (input) => {
          await prisma.trainerProfile.update({
            where: { userId: approved.id },
            data: { isActive: false, revokedAt: new Date(), revokedById: trainerOne.id },
          });
          return createWithLocks(input);
        });

      try {
        const response = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', cookie)
          .send({ userId: approved.id });

        expect(response.status).toBe(409);
        expect(
          await prisma.trainerAthlete.count({
            where: { trainerId: approved.id, athleteId: athlete.id },
          }),
        ).toBe(0);
      } finally {
        spy.mockRestore();
        await prisma.trainerProfile.deleteMany({ where: { userId: approved.id } });
      }
    }, 25_000);

    it('uses current capabilities for approved, revoked and dual-role invitations', async () => {
      const approved = await createUser(
        `approved-relationship-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const firstAthlete = await createUser(
        `first-relationship-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const secondAthlete = await createUser(
        `second-relationship-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const revoked = await createUser(
        `revoked-relationship-${randomUUID()}@example.com`,
        'TRAINER',
      );
      const ids: string[] = [];

      try {
        await prisma.trainerProfile.create({
          data: {
            userId: approved.id,
            isActive: true,
            approvedAt: new Date(),
            approvedById: trainerOne.id,
          },
        });
        await prisma.trainerProfile.create({
          data: {
            userId: revoked.id,
            isActive: false,
            revokedAt: new Date(),
            revokedById: trainerOne.id,
          },
        });

        // Log in after profile creation. Neither role value is upgraded.
        const approvedCookie = await login(approved.email);
        const secondAthleteCookie = await login(secondAthlete.email);
        const revokedCookie = await login(revoked.email);

        const trainerInvites = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', approvedCookie)
          .send({ userId: firstAthlete.id });
        expect(trainerInvites.status).toBe(201);
        expect(trainerInvites.body).toMatchObject({
          trainerId: approved.id,
          athleteId: firstAthlete.id,
          initiatedById: approved.id,
          status: 'PENDING',
        });
        ids.push(trainerInvites.body.id);

        // Approved ATHLETE-role trainers must never receive former-athlete
        // contact details through history or mutation responses.
        const cancelled = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${trainerInvites.body.id}/cancel`)
          .set('Cookie', approvedCookie)
          .send({ reason: 'Invitation withdrawn' });
        expect(cancelled.status).toBe(200);
        expect(cancelled.body.status).toBe('CANCELLED');
        expect(JSON.stringify(cancelled.body)).not.toContain(firstAthlete.email);

        const firstAthleteCookie = await login(firstAthlete.email);
        const [trainerHistoryDetail, trainerHistoryList, athleteHistoryDetail] = await Promise.all([
          request(app!.getHttpServer())
            .get(`/trainer-athletes/${trainerInvites.body.id}`)
            .set('Cookie', approvedCookie),
          request(app!.getHttpServer())
            .get('/trainer-athletes')
            .set('Cookie', approvedCookie)
            .query({ status: 'CANCELLED', page: 1, limit: 100 }),
          request(app!.getHttpServer())
            .get(`/trainer-athletes/${trainerInvites.body.id}`)
            .set('Cookie', firstAthleteCookie),
        ]);

        expect(trainerHistoryDetail.status).toBe(200);
        expect(trainerHistoryList.status).toBe(200);
        expect(athleteHistoryDetail.status).toBe(200);
        expect(JSON.stringify(trainerHistoryDetail.body)).not.toContain(firstAthlete.email);
        const trainerHistoricalItem = trainerHistoryList.body.data.find(
          (item: { id: string }) => item.id === trainerInvites.body.id,
        );
        expect(trainerHistoricalItem).toBeDefined();
        expect(JSON.stringify(trainerHistoricalItem)).not.toContain(firstAthlete.email);
        expect(athleteHistoryDetail.body.athlete.email).toBe(firstAthlete.email);

        // The same account still retains full history from its ATHLETE side.
        const ownAthleteHistory = await prisma.trainerAthlete.create({
          data: {
            trainerId: trainerOne.id,
            athleteId: approved.id,
            initiatedById: trainerOne.id,
            status: 'TERMINATED',
          },
          select: { id: true },
        });
        ids.push(ownAthleteHistory.id);
        const ownHistory = await request(app!.getHttpServer())
          .get(`/trainer-athletes/${ownAthleteHistory.id}`)
          .set('Cookie', approvedCookie);
        expect(ownHistory.status).toBe(200);
        expect(ownHistory.body.athlete.email).toBe(approved.email);

        const athleteInvites = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', secondAthleteCookie)
          .send({ userId: approved.id });
        expect(athleteInvites.status).toBe(201);
        expect(athleteInvites.body).toMatchObject({
          trainerId: approved.id,
          athleteId: secondAthlete.id,
          initiatedById: secondAthlete.id,
        });
        ids.push(athleteInvites.body.id);

        const revokedInitiator = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', revokedCookie)
          .send({ userId: firstAthlete.id });
        expect(revokedInitiator.status).toBe(400);

        const revokedTarget = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', secondAthleteCookie)
          .send({ userId: revoked.id });
        expect(revokedTarget.status).toBe(400);

        // Both sides may be trainers; userId alone cannot express direction.
        const ambiguous = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', approvedCookie)
          .send({ userId: trainerOne.id });
        expect(ambiguous.status).toBe(400);

        // The same authenticated session loses trainer capability immediately.
        await prisma.trainerProfile.update({
          where: { userId: approved.id },
          data: { isActive: false, revokedAt: new Date(), revokedById: trainerOne.id },
        });
        const afterRevocation = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', approvedCookie)
          .send({ userId: firstAthlete.id });
        expect(afterRevocation.status).toBe(400);

        const unauthorized = await prisma.trainerAthlete.count({
          where: {
            OR: [{ trainerId: revoked.id }, { athleteId: revoked.id }],
          },
        });
        expect(unauthorized).toBe(0);
      } finally {
        await prisma.trainerAthlete.deleteMany({ where: { id: { in: ids } } });
        await prisma.trainerProfile.deleteMany({
          where: { userId: { in: [approved.id, revoked.id] } },
        });
      }
    }, 30_000);

    it('should allow a trainer to initiate a relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .send({
          userId: athleteOne.id,
        });

      expect(response.status).toBe(201);

      expect(response.body).toMatchObject({
        trainerId: trainerOne.id,
        athleteId: athleteOne.id,
        initiatedById: trainerOne.id,
        status: 'PENDING',
      });

      trainerInitiatedRelationshipId = response.body.id;
    });

    it('should allow the athlete to initiate a relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', athleteTwoCookie)
        .send({
          userId: trainerOne.id,
        });

      expect(response.status).toBe(201);

      expect(response.body).toMatchObject({
        trainerId: trainerOne.id,
        athleteId: athleteTwo.id,
        initiatedById: athleteTwo.id,
        status: 'PENDING',
      });

      athleteInitiatedRelationshipId = response.body.id;
    });

    it('should reject a duplicate open relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .send({
          userId: athleteOne.id,
        });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /trainer-athletes', () => {
    it('updates read privacy after approval revocation and denies stale admin sessions', async () => {
      const approved = await createUser(`read-approved-${randomUUID()}@example.com`, 'ATHLETE');
      const athlete = await createUser(`read-athlete-${randomUUID()}@example.com`, 'ATHLETE');
      const invited = await createUser(`read-invited-${randomUUID()}@example.com`, 'ATHLETE');
      const ids: string[] = [];

      try {
        await prisma.trainerProfile.create({
          data: {
            userId: approved.id,
            isActive: true,
            approvedAt: new Date(),
            approvedById: trainerOne.id,
          },
        });

        const cookie = await login(approved.email);
        const active = await prisma.trainerAthlete.create({
          data: {
            trainerId: approved.id,
            athleteId: athlete.id,
            initiatedById: approved.id,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        ids.push(active.id);

        const pending = await prisma.trainerAthlete.create({
          data: {
            trainerId: approved.id,
            athleteId: invited.id,
            initiatedById: approved.id,
            status: 'PENDING',
          },
          select: { id: true },
        });
        ids.push(pending.id);

        // The same user is also an athlete in another, already ended relationship.
        const ownHistory = await prisma.trainerAthlete.create({
          data: {
            trainerId: trainerOne.id,
            athleteId: approved.id,
            initiatedById: approved.id,
            status: 'TERMINATED',
          },
          select: { id: true },
        });
        ids.push(ownHistory.id);

        const [beforeList, beforeDetails] = await Promise.all([
          request(app!.getHttpServer()).get('/trainer-athletes').set('Cookie', cookie),
          request(app!.getHttpServer()).get(`/trainer-athletes/${active.id}`).set('Cookie', cookie),
        ]);
        expect(beforeList.status).toBe(200);
        expect(beforeDetails.status).toBe(200);
        expect(beforeDetails.body.athlete.email).toBe(athlete.email);

        await prisma.trainerProfile.update({
          where: { userId: approved.id },
          data: { isActive: false, revokedAt: new Date(), revokedById: trainerOne.id },
        });

        const [revokedList, activeDetails, pendingDetails, ownHistoryDetails] = await Promise.all([
          request(app!.getHttpServer()).get('/trainer-athletes').set('Cookie', cookie),
          request(app!.getHttpServer()).get(`/trainer-athletes/${active.id}`).set('Cookie', cookie),
          request(app!.getHttpServer())
            .get(`/trainer-athletes/${pending.id}`)
            .set('Cookie', cookie),
          request(app!.getHttpServer())
            .get(`/trainer-athletes/${ownHistory.id}`)
            .set('Cookie', cookie),
        ]);

        expect(revokedList.status).toBe(200);
        expect(activeDetails.status).toBe(200);
        expect(pendingDetails.status).toBe(200);
        expect(ownHistoryDetails.status).toBe(200);
        expect(activeDetails.body.status).toBe('ACTIVE');
        expect(pendingDetails.body.status).toBe('PENDING');

        for (const item of [activeDetails.body, pendingDetails.body]) {
          expect(JSON.stringify(item)).not.toContain(athlete.email);
          expect(JSON.stringify(item)).not.toContain(invited.email);
          expect(item.athlete).not.toHaveProperty('email');
        }

        const activeListItem = revokedList.body.data.find(
          (item: { id: string }) => item.id === active.id,
        );
        const pendingListItem = revokedList.body.data.find(
          (item: { id: string }) => item.id === pending.id,
        );
        expect(activeListItem).toBeDefined();
        expect(pendingListItem).toBeDefined();
        expect(activeListItem.athlete).not.toHaveProperty('email');
        expect(pendingListItem.athlete).not.toHaveProperty('email');
        expect(ownHistoryDetails.body.athlete.email).toBe(approved.email);

        // Read-only redaction does not lock out an existing trainer's cleanup actions.
        const ended = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${active.id}/terminate`)
          .set('Cookie', cookie)
          .send({ reason: 'Revoked trainer access' });
        const cancelled = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${pending.id}/cancel`)
          .set('Cookie', cookie);
        expect(ended.status).toBe(200);
        expect(cancelled.status).toBe(200);

        await prisma.user.update({
          where: { id: approved.id },
          data: { role: 'ADMIN' },
        });

        const [deniedList, deniedDetails] = await Promise.all([
          request(app!.getHttpServer()).get('/trainer-athletes').set('Cookie', cookie),
          request(app!.getHttpServer())
            .get(`/trainer-athletes/${ownHistory.id}`)
            .set('Cookie', cookie),
        ]);
        expect(deniedList.status).toBe(403);
        expect(deniedDetails.status).toBe(403);
      } finally {
        await prisma.trainerAthlete.deleteMany({ where: { id: { in: ids } } });
        await prisma.trainerProfile.deleteMany({ where: { userId: approved.id } });
      }
    }, 40_000);

    it('should return relationships for the trainer', async () => {
      const response = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .query({
          status: 'PENDING',
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);

      const ids = response.body.data.map((relationship: { id: string }) => relationship.id);

      expect(ids).toContain(trainerInitiatedRelationshipId);
      expect(ids).toContain(athleteInitiatedRelationshipId);
    });

    it('should return relationships for the athlete', async () => {
      const response = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', athleteTwoCookie);

      expect(response.status).toBe(200);

      const ids = response.body.data.map((relationship: { id: string }) => relationship.id);

      expect(ids).toContain(athleteInitiatedRelationshipId);
    });

    it('should not return another user relationships', async () => {
      const response = await request(app!.getHttpServer())
        .get('/trainer-athletes')
        .set('Cookie', outsiderCookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /trainer-athletes/:id', () => {
    it('should return relationship details to a participant', async () => {
      const response = await request(app!.getHttpServer())
        .get(`/trainer-athletes/${trainerInitiatedRelationshipId}`)
        .set('Cookie', athleteOneCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(trainerInitiatedRelationshipId);
    });

    it('should hide a relationship from an unrelated user', async () => {
      const response = await request(app!.getHttpServer())
        .get(`/trainer-athletes/${trainerInitiatedRelationshipId}`)
        .set('Cookie', outsiderCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('Accept and decline', () => {
    it('accepts an approved ATHLETE-role trainer, then rejects revocation and allows cleanup', async () => {
      const approved = await createUser(
        `approved-transition-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const firstAthlete = await createUser(
        `transition-athlete-one-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const secondAthlete = await createUser(
        `transition-athlete-two-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const ids: string[] = [];

      try {
        await prisma.trainerProfile.create({
          data: {
            userId: approved.id,
            isActive: true,
            approvedAt: new Date(),
            approvedById: trainerOne.id,
          },
        });

        const trainerCookie = await login(approved.email);
        const athleteOneCookie = await login(firstAthlete.email);
        const athleteTwoCookie = await login(secondAthlete.email);

        const initial = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', athleteOneCookie)
          .send({ userId: approved.id });
        expect(initial.status).toBe(201);
        ids.push(initial.body.id);

        const accepted = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${initial.body.id}/accept`)
          .set('Cookie', trainerCookie);
        expect(accepted.status).toBe(200);
        expect(accepted.body).toMatchObject({
          trainerId: approved.id,
          athleteId: firstAthlete.id,
          status: 'ACTIVE',
        });

        const second = await request(app!.getHttpServer())
          .post('/trainer-athletes')
          .set('Cookie', athleteTwoCookie)
          .send({ userId: approved.id });
        expect(second.status).toBe(201);
        ids.push(second.body.id);

        // The original session remains valid, but TrainerProfile is revoked.
        await prisma.trainerProfile.update({
          where: { userId: approved.id },
          data: { isActive: false, revokedAt: new Date(), revokedById: trainerOne.id },
        });

        const noActivation = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${second.body.id}/accept`)
          .set('Cookie', trainerCookie);
        expect(noActivation.status).toBe(409);

        const stillPending = await prisma.trainerAthlete.findUnique({
          where: { id: second.body.id },
          select: { status: true },
        });
        expect(stillPending?.status).toBe('PENDING');

        // Revoked trainers can exit an invitation and an active relationship.
        const declined = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${second.body.id}/decline`)
          .set('Cookie', trainerCookie);
        expect(declined.status).toBe(200);
        expect(declined.body.status).toBe('DECLINED');
        expect(JSON.stringify(declined.body)).not.toContain(secondAthlete.email);

        const terminated = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${initial.body.id}/terminate`)
          .set('Cookie', trainerCookie)
          .send({ reason: 'Trainer permission revoked' });
        expect(terminated.status).toBe(200);
        expect(terminated.body.status).toBe('TERMINATED');
        expect(JSON.stringify(terminated.body)).not.toContain(firstAthlete.email);
      } finally {
        await prisma.trainerAthlete.deleteMany({ where: { id: { in: ids } } });
        await prisma.trainerProfile.deleteMany({ where: { userId: approved.id } });
      }
    }, 30_000);

    it('rejects a stale trainer session after an account is promoted to admin', async () => {
      const trainer = await createUser(`transition-admin-${randomUUID()}@example.com`, 'TRAINER');
      const athlete = await createUser(
        `transition-admin-athlete-${randomUUID()}@example.com`,
        'ATHLETE',
      );
      const cookie = await login(trainer.email);
      const relationship = await prisma.trainerAthlete.create({
        data: {
          trainerId: trainer.id,
          athleteId: athlete.id,
          initiatedById: trainer.id,
          status: 'PENDING',
        },
        select: { id: true },
      });

      try {
        await prisma.user.update({
          where: { id: trainer.id },
          data: { role: 'ADMIN' },
        });

        const response = await request(app!.getHttpServer())
          .post(`/trainer-athletes/${relationship.id}/cancel`)
          .set('Cookie', cookie);
        expect(response.status).toBe(403);

        const current = await prisma.trainerAthlete.findUnique({
          where: { id: relationship.id },
          select: { status: true },
        });
        expect(current?.status).toBe('PENDING');
      } finally {
        await prisma.trainerAthlete.deleteMany({ where: { id: relationship.id } });
      }
    }, 20_000);

    it('should reject acceptance by the request initiator', async () => {
      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${trainerInitiatedRelationshipId}/accept`)
        .set('Cookie', trainerOneCookie);

      expect(response.status).toBe(403);
    });

    it('should allow the recipient to accept the request', async () => {
      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${trainerInitiatedRelationshipId}/accept`)
        .set('Cookie', athleteOneCookie);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        id: trainerInitiatedRelationshipId,
        status: 'ACTIVE',
      });

      expect(response.body.respondedAt).toBeTruthy();
    });

    it('should reject a duplicate active relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', athleteOneCookie)
        .send({
          userId: trainerOne.id,
        });

      expect(response.status).toBe(409);
    });

    it('should reject declining a request by its initiator', async () => {
      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${athleteInitiatedRelationshipId}/decline`)
        .set('Cookie', athleteTwoCookie);

      expect(response.status).toBe(403);
    });

    it('should allow the recipient to decline a pending request', async () => {
      const createResponse = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', athleteTwoCookie)
        .send({
          userId: trainerTwo.id,
        });

      expect(createResponse.status).toBe(201);

      declinedRelationshipId = createResponse.body.id;

      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${declinedRelationshipId}/decline`)
        .set('Cookie', trainerTwoCookie);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        id: declinedRelationshipId,
        status: 'DECLINED',
      });

      expect(response.body.respondedAt).toBeTruthy();
    });

    it('should allow a new request after a declined relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', athleteTwoCookie)
        .send({
          userId: trainerTwo.id,
        });

      const cancelResponse = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${response.body.id}/cancel`)
        .set('Cookie', athleteTwoCookie);

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.status).toBe('CANCELLED');
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.id).not.toBe(declinedRelationshipId);
    });
  });

  describe('Cancel pending requests', () => {
    it('should reject cancellation by the request recipient', async () => {
      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${athleteInitiatedRelationshipId}/cancel`)
        .set('Cookie', trainerOneCookie)
        .send({
          reason: 'Should not be allowed',
        });

      expect(response.status).toBe(403);
    });

    it('should allow the initiator to cancel a pending request', async () => {
      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${athleteInitiatedRelationshipId}/cancel`)
        .set('Cookie', athleteTwoCookie)
        .send({
          reason: 'Changed my mind',
        });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        id: athleteInitiatedRelationshipId,
        status: 'CANCELLED',
        endedById: athleteTwo.id,
        endReason: 'Changed my mind',
      });

      expect(response.body.endedAt).toBeTruthy();
    });

    it('should allow a new request after cancellation', async () => {
      const response = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', trainerOneCookie)
        .send({
          userId: athleteTwo.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('PENDING');

      const cancelResponse = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${response.body.id}/cancel`)
        .set('Cookie', trainerOneCookie);

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.status).toBe('CANCELLED');
    });
  });

  describe('Terminate active relationships', () => {
    it('should allow the trainer to terminate an active relationship', async () => {
      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${trainerInitiatedRelationshipId}/terminate`)
        .set('Cookie', trainerOneCookie)
        .send({
          reason: 'Cooperation ended by trainer',
        });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        id: trainerInitiatedRelationshipId,
        status: 'TERMINATED',
        endedById: trainerOne.id,
        endReason: 'Cooperation ended by trainer',
      });

      expect(response.body.endedAt).toBeTruthy();
    });

    it('should allow a new request after termination', async () => {
      const createResponse = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', athleteOneCookie)
        .send({
          userId: trainerOne.id,
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.status).toBe('PENDING');

      const acceptResponse = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${createResponse.body.id}/accept`)
        .set('Cookie', trainerOneCookie);

      expect(acceptResponse.status).toBe(200);
      expect(acceptResponse.body.status).toBe('ACTIVE');

      const terminateResponse = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${createResponse.body.id}/terminate`)
        .set('Cookie', athleteOneCookie)
        .send({
          reason: 'Cooperation ended by athlete',
        });

      expect(terminateResponse.status).toBe(200);

      expect(terminateResponse.body).toMatchObject({
        status: 'TERMINATED',
        endedById: athleteOne.id,
        endReason: 'Cooperation ended by athlete',
      });
    });

    it('should reject termination of a pending relationship', async () => {
      const createResponse = await request(app!.getHttpServer())
        .post('/trainer-athletes')
        .set('Cookie', trainerTwoCookie)
        .send({
          userId: athleteTwo.id,
        });

      expect(createResponse.status).toBe(201);

      const response = await request(app!.getHttpServer())
        .post(`/trainer-athletes/${createResponse.body.id}/terminate`)
        .set('Cookie', trainerTwoCookie);

      expect(response.status).toBe(409);
    });
  });
});
