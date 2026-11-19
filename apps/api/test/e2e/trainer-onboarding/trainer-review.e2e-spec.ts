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

describe('Operator trainer review (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const operatorId = randomUUID();
  const priorAllowlist = process.env.SUPERADMIN_USER_IDS;
  const password = 'StrongPassword123!';
  const users: string[] = [];
  const cookies: Record<string, string> = {};
  let pendingId: string;
  let secondId: string;

  async function createUser(
    key: string,
    role: 'ATHLETE' | 'TRAINER' | 'ADMIN',
    userId = randomUUID(),
  ) {
    const email = `trainer-review-${key}-${randomUUID()}@example.test`;
    const hasher = app.get(PasswordHasher);
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        passwordHash: await hasher.hash(password),
        role,
        emailVerified: true,
      },
      select: { id: true },
    });
    users.push(user.id);

    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const setCookies = login.headers['set-cookie'];
    const values = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
    const cookie = values
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-sid='));
    if (!cookie) throw new Error('No test session cookie');
    cookies[key] = cookie;
    return user;
  }

  const asUser = (key: string) => cookies[key] ?? '';
  const url = (id: string, action: string) => `/admin/trainer-applications/${id}/${action}`;

  beforeAll(async () => {
    useTestDatabase();
    process.env.SUPERADMIN_USER_IDS = operatorId;
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

    await createUser('operator', 'ADMIN', operatorId);
    await createUser('plain-admin', 'ADMIN');
    await createUser('athlete', 'ATHLETE');
    await createUser('other', 'ATHLETE');
    await createUser('trainer', 'TRAINER');

    const apply = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', asUser('athlete'))
      .send({ applicantNote: 'I am a qualified strength coach with multiple certifications.' });
    expect(apply.status).toBe(201);
    pendingId = apply.body.id as string;
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && users.length) {
        await prisma.trainerApplication.deleteMany({ where: { userId: { in: users } } });
        await prisma.trainerProfile.deleteMany({ where: { userId: { in: users } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      await app?.close();
      if (priorAllowlist === undefined) delete process.env.SUPERADMIN_USER_IDS;
      else process.env.SUPERADMIN_USER_IDS = priorAllowlist;
    }
  }, 20_000);

  it('denies anonymous, regular admins and applicants from the review queue and decisions', async () => {
    const endpoint = url(pendingId, 'approve');
    for (const key of ['plain-admin', 'athlete', 'trainer']) {
      const listing = await request(app.getHttpServer())
        .get('/admin/trainer-applications')
        .set('Cookie', asUser(key));
      expect(listing.status).toBe(403);

      const mutation = await request(app.getHttpServer())
        .post(endpoint)
        .set('Cookie', asUser(key))
        .send({ reason: 'Verified qualifications' });
      expect(mutation.status).toBe(403);
    }

    const anon = await request(app.getHttpServer()).post(endpoint).send({
      reason: 'Verified qualifications',
    });
    expect(anon.status).toBe(401);
    expect(anon.headers['cache-control']).toContain('no-store');
  });

  it('limits elevated pending queue to applications, with no cross-account access', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/trainer-applications')
      .set('Cookie', asUser('operator'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: pendingId, status: 'PENDING' })]),
    );
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('rejects unexpected fields, missing reason and invalid IDs', async () => {
    for (const payload of [
      {},
      { reason: 'short' },
      { reason: 'Verified qualifications', status: 'APPROVED' },
      { reason: 'Verified qualifications', role: 'TRAINER' },
      { reason: 'Verified qualifications', userId: users[2] },
    ]) {
      const response = await request(app.getHttpServer())
        .post(url(pendingId, 'approve'))
        .set('Cookie', asUser('operator'))
        .send(payload);
      expect(response.status).toBe(400);
    }
    const invalid = await request(app.getHttpServer())
      .post(url('not-an-id', 'approve'))
      .set('Cookie', asUser('operator'))
      .send({ reason: 'Verified qualifications' });
    expect(invalid.status).toBe(400);
  });

  it('rejects a request and persists reviewer/time without creating trainer capabilities', async () => {
    const reason = 'No valid training certificates provided';
    const response = await request(app.getHttpServer())
      .post(url(pendingId, 'reject'))
      .set('Cookie', asUser('operator'))
      .send({ reason });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: pendingId,
      status: 'REJECTED',
      reviewerId: operatorId,
      reviewReason: reason,
    });
    expect(response.body.reviewedAt).toEqual(expect.any(String));
    const again = await request(app.getHttpServer())
      .post(url(pendingId, 'reject'))
      .set('Cookie', asUser('operator'))
      .send({ reason });
    expect(again.status).toBe(200);
    expect(again.body.reviewedAt).toBe(response.body.reviewedAt);
    const profile = await prisma.trainerProfile.findUnique({ where: { userId: users[2] } });
    expect(profile).toBeNull();
  });

  it('allows reapplication and atomic approval without replacing ATHLETE role', async () => {
    const apply = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', asUser('athlete'))
      .send({ applicantNote: 'Qualified coach resubmitting all required proof.' });
    expect(apply.status).toBe(201);
    secondId = apply.body.id as string;
    const reason = 'Identity and coaching credentials verified';

    const response = await request(app.getHttpServer())
      .post(url(secondId, 'approve'))
      .set('Cookie', asUser('operator'))
      .send({ reason });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'APPROVED',
      reviewerId: operatorId,
      reviewReason: reason,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: users[2] },
      select: { role: true, trainerProfile: true },
    });
    expect(user.role).toBe('ATHLETE');
    expect(user.trainerProfile).toMatchObject({
      isActive: true,
      approvedById: operatorId,
      revokedAt: null,
    });

    const repeat = await request(app.getHttpServer())
      .post(url(secondId, 'approve'))
      .set('Cookie', asUser('operator'))
      .send({ reason });
    expect(repeat.status).toBe(200);
    expect(repeat.body.reviewedAt).toBe(response.body.reviewedAt);

    const mutatedReason = await request(app.getHttpServer())
      .post(url(secondId, 'approve'))
      .set('Cookie', asUser('operator'))
      .send({ reason: 'Attempt to change a completed review' });
    expect(mutatedReason.status).toBe(409);

    const selfSubmit = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', asUser('athlete'))
      .send({ applicantNote: 'Attempt to submit after approval is not allowed.' });
    expect(selfSubmit.status).toBe(403);
  });

  it('revokes both application and capability in one audited decision', async () => {
    const reason = 'Verified violation of trainer community standards';
    const response = await request(app.getHttpServer())
      .post(url(secondId, 'revoke'))
      .set('Cookie', asUser('operator'))
      .send({ reason });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'REVOKED',
      revokedById: operatorId,
      revokeReason: reason,
      reviewReason: 'Identity and coaching credentials verified',
    });

    const profile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: users[2] },
    });
    expect(profile.isActive).toBe(false);
    expect(profile.revokedById).toBe(operatorId);
    expect(profile.revokedAt).toBeInstanceOf(Date);
    const retry = await request(app.getHttpServer())
      .post(url(secondId, 'revoke'))
      .set('Cookie', asUser('operator'))
      .send({ reason });
    expect(retry.status).toBe(200);
    expect(retry.body.revokedAt).toBe(response.body.revokedAt);
    const mismatch = await request(app.getHttpServer())
      .post(url(secondId, 'revoke'))
      .set('Cookie', asUser('operator'))
      .send({ reason: 'Attempted revision of a completed action' });
    expect(mismatch.status).toBe(409);
  });

  it('keeps applicant history and allows another request after revocation', async () => {
    const submit = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', asUser('athlete'))
      .send({ applicantNote: 'Request for a second review after revocation.' });
    expect(submit.status).toBe(201);
    const histories = await prisma.trainerApplication.findMany({
      where: { userId: users[2] },
      select: { status: true },
    });
    expect(histories.map((history) => history.status).sort()).toEqual([
      'PENDING',
      'REJECTED',
      'REVOKED',
    ]);
  });

  it('refuses to review if the database administrator role has been removed', async () => {
    await prisma.user.update({ where: { id: operatorId }, data: { role: 'ATHLETE' } });
    try {
      const result = await request(app.getHttpServer())
        .post(url(secondId, 'approve'))
        .set('Cookie', asUser('operator'))
        .send({ reason: 'Attempts to use revoked admin status' });
      expect(result.status).toBe(403);
    } finally {
      await prisma.user.update({ where: { id: operatorId }, data: { role: 'ADMIN' } });
    }
  });
});
