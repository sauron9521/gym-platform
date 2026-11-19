import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Trainer applications (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'StrongPassword123!';
  const users: { id: string; email: string }[] = [];
  const cookies: Record<string, string> = {};

  const note = 'I have several years of coaching experience in strength training.';
  const updatedNote = 'Updated coaching qualifications and strength training experience.';

  function extractSession(header: string | string[] | undefined): string {
    const headers = Array.isArray(header) ? header : header ? [header] : [];
    const cookie = headers
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-sid='));
    if (!cookie) throw new Error('Missing session cookie');
    return cookie;
  }

  async function createUser(key: string, role: 'ATHLETE' | 'TRAINER' | 'ADMIN', verified = true) {
    const email = `trainer-application-${key}-${randomUUID()}@example.com`;
    const hasher = app.get(PasswordHasher);
    const user = await prisma.user.create({
      data: {
        email,
        role,
        emailVerified: verified,
        passwordHash: await hasher.hash(password),
      },
      select: { id: true, email: true },
    });
    users.push(user);

    const response = await request(app.getHttpServer()).post('/auth/login').send({
      email,
      password,
    });
    expect(response.status).toBe(200);
    cookies[key] = extractSession(response.headers['set-cookie']);
    return user;
  }

  const cookieFor = (key: string) => cookies[key] ?? '';

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    })
      // The throttling metadata is tested separately. This suite exercises
      // business rules without requiring a shared Redis/IP token budget.
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);

    await createUser('owner', 'ATHLETE');
    await createUser('other', 'ATHLETE');
    await createUser('unverified', 'ATHLETE', false);
    await createUser('trainer', 'TRAINER');
    await createUser('admin', 'ADMIN');
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && users.length) {
        const ids = users.map((user) => user.id);
        await prisma.trainerApplication.deleteMany({ where: { userId: { in: ids } } });
        await prisma.trainerProfile.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('requires a session on all three endpoints', async () => {
    const get = await request(app.getHttpServer()).get('/trainer-applications/me');
    const post = await request(app.getHttpServer())
      .post('/trainer-applications')
      .send({ applicantNote: note });
    const patch = await request(app.getHttpServer())
      .patch('/trainer-applications/me')
      .send({ applicantNote: updatedNote });

    expect([get.status, post.status, patch.status]).toEqual([401, 401, 401]);
    expect(get.headers['cache-control']).toContain('no-store');
    expect(post.headers['cache-control']).toContain('no-store');
  });

  it('returns null when the authenticated athlete has no application', async () => {
    const get = await request(app.getHttpServer())
      .get('/trainer-applications/me')
      .set('Cookie', cookieFor('owner'));

    expect(get.status).toBe(200);
    expect(get.body).toEqual({ application: null });
    expect(get.headers['cache-control']).toContain('no-store');
  });

  it('rejects unverifiable or privileged applicants', async () => {
    for (const key of ['unverified', 'trainer', 'admin']) {
      const response = await request(app.getHttpServer())
        .post('/trainer-applications')
        .set('Cookie', cookieFor(key))
        .send({ applicantNote: note });
      expect(response.status).toBe(403);
    }
  });

  it('strictly rejects invalid payloads and privilege fields', async () => {
    for (const body of [
      {},
      { applicantNote: 'too short' },
      { applicantNote: 'A'.repeat(1001) },
      { applicantNote: note, role: 'TRAINER' },
      { applicantNote: note, status: 'APPROVED' },
      { applicantNote: note, userId: users[1]?.id },
      { applicantNote: note, reviewerId: users[4]?.id },
    ]) {
      const post = await request(app.getHttpServer())
        .post('/trainer-applications')
        .set('Cookie', cookieFor('owner'))
        .send(body);
      expect(post.status).toBe(400);
    }
  });

  it('creates a pending applicant-only row and returns no sensitive metadata', async () => {
    const post = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', cookieFor('owner'))
      .send({ applicantNote: '  ' + note + '  ' });

    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({ status: 'PENDING', applicantNote: note });
    for (const privateField of ['userId', 'reviewerId', 'revokedById', 'role']) {
      expect(post.body).not.toHaveProperty(privateField);
    }

    const account = await prisma.user.findUniqueOrThrow({
      where: { id: users[0]!.id },
      select: { role: true, trainerProfile: true },
    });
    expect(account).toEqual({ role: 'ATHLETE', trainerProfile: null });

    const other = await request(app.getHttpServer())
      .get('/trainer-applications/me')
      .set('Cookie', cookieFor('other'));
    expect(other.status).toBe(200);
    expect(other.body).toEqual({ application: null });
  });

  it('prevents a second open application and edits only owner pending notes', async () => {
    const duplicate = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', cookieFor('owner'))
      .send({ applicantNote: note });
    expect(duplicate.status).toBe(409);

    const edit = await request(app.getHttpServer())
      .patch('/trainer-applications/me')
      .set('Cookie', cookieFor('owner'))
      .send({ applicantNote: updatedNote });
    expect(edit.status).toBe(200);
    expect(edit.body).toMatchObject({ status: 'PENDING', applicantNote: updatedNote });
    expect(edit.body).not.toHaveProperty('userId');

    for (const body of [
      { applicantNote: note, status: 'APPROVED' },
      { applicantNote: note, reviewerId: users[4]?.id },
    ]) {
      const invalid = await request(app.getHttpServer())
        .patch('/trainer-applications/me')
        .set('Cookie', cookieFor('owner'))
        .send(body);
      expect(invalid.status).toBe(400);
    }

    const other = await request(app.getHttpServer())
      .patch('/trainer-applications/me')
      .set('Cookie', cookieFor('other'))
      .send({ applicantNote: note });
    expect(other.status).toBe(409);
  });

  it('permits a single concurrent reapplication after rejection', async () => {
    const pending = await prisma.trainerApplication.findFirstOrThrow({
      where: { userId: users[0]!.id, status: 'PENDING' },
    });
    await prisma.trainerApplication.update({
      where: { id: pending.id },
      data: {
        status: 'REJECTED',
        reviewerId: users[4]!.id,
        reviewedAt: new Date(),
        reviewReason: 'Additional qualifications required',
      },
    });

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/trainer-applications')
        .set('Cookie', cookieFor('owner'))
        .send({ applicantNote: note }),
      request(app.getHttpServer())
        .post('/trainer-applications')
        .set('Cookie', cookieFor('owner'))
        .send({ applicantNote: updatedNote }),
    ]);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);

    const history = await prisma.trainerApplication.findMany({
      where: { userId: users[0]!.id },
    });
    expect(history.map((item) => item.status).sort()).toEqual(['PENDING', 'REJECTED']);
    expect(history.find((item) => item.status === 'REJECTED')?.reviewReason).toBe(
      'Additional qualifications required',
    );
  });

  it('denies client modifications after review and does not leak the reviewer', async () => {
    const pending = await prisma.trainerApplication.findFirstOrThrow({
      where: { userId: users[0]!.id, status: 'PENDING' },
    });
    await prisma.trainerApplication.update({
      where: { id: pending.id },
      data: { status: 'APPROVED', reviewerId: users[4]!.id, reviewedAt: new Date() },
    });

    const approved = await request(app.getHttpServer())
      .get('/trainer-applications/me')
      .set('Cookie', cookieFor('owner'));
    expect(approved.status).toBe(200);
    expect(approved.body.application.status).toBe('APPROVED');
    expect(approved.body.application).not.toHaveProperty('reviewerId');

    const edit = await request(app.getHttpServer())
      .patch('/trainer-applications/me')
      .set('Cookie', cookieFor('owner'))
      .send({ applicantNote: updatedNote });
    expect(edit.status).toBe(409);
    const submit = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', cookieFor('owner'))
      .send({ applicantNote: note });
    expect(submit.status).toBe(409);
  });

  it('allows a new request after audited revocation but never self-activates', async () => {
    const approved = await prisma.trainerApplication.findFirstOrThrow({
      where: { userId: users[0]!.id, status: 'APPROVED' },
    });
    await prisma.trainerApplication.update({
      where: { id: approved.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: users[4]!.id,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', cookieFor('owner'))
      .send({ applicantNote: note });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('PENDING');

    const account = await prisma.user.findUniqueOrThrow({
      where: { id: users[0]!.id },
      select: { role: true, trainerProfile: true },
    });
    expect(account).toEqual({ role: 'ATHLETE', trainerProfile: null });
  });

  it('rejects stale sessions once the session is revoked', async () => {
    await prisma.session.deleteMany({ where: { userId: users[0]!.id } });
    const result = await request(app.getHttpServer())
      .get('/trainer-applications/me')
      .set('Cookie', cookieFor('owner'));
    expect(result.status).toBe(401);
  });
});
