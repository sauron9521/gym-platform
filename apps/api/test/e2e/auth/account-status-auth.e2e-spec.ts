import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

/**
 * Directly changing status is test setup only, NOT a supported operation.
 * The future Admin action MUST atomically revoke sessions and token families.
 */
describe('persisted SUSPENDED auth gates (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const id = randomUUID();
  const email = `status-auth-${id}@example.test`;
  const password = 'StrongPassword123!';
  let sessionCookie: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
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

    const passwordHash = await app.get(PasswordHasher).hash(password);
    await prisma.user.create({
      data: { id, email, passwordHash, emailVerified: true },
    });
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    expect(stored.status).toBe('ACTIVE');

    const session = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    expect(session.status).toBe(200);
    const raw = session.headers['set-cookie'];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    sessionCookie =
      values.map((s) => s.split(';', 1)[0] ?? '').find((s) => s.startsWith('__Host-sid=')) ?? '';
    expect(sessionCookie).toBeTruthy();

    const pair = await request(app.getHttpServer()).post('/auth/token').send({ email, password });
    expect(pair.status).toBe(200);
    expect(pair.body.accessToken).toBeTruthy();
    expect(pair.body.refreshToken).toBeTruthy();
    accessToken = pair.body.accessToken;
    refreshToken = pair.body.refreshToken;
  }, 35_000);

  afterAll(async () => {
    try {
      if (prisma) await prisma.user.deleteMany({ where: { id } });
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('authenticates an ACTIVE account through both cookie and JWT before suspension', async () => {
    const cookie = await request(app.getHttpServer()).get('/users/me').set('Cookie', sessionCookie);
    expect(cookie.status).toBe(200);
    expect(cookie.body.id).toBe(id);

    const bearer = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(bearer.status).toBe(200);
    expect(bearer.body.id).toBe(id);
  });

  it('denies old cookie/JWT/refresh and new password login or token after persistence changes to SUSPENDED', async () => {
    await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });

    for (const authenticated of [
      request(app.getHttpServer()).get('/users/me').set('Cookie', sessionCookie),
      request(app.getHttpServer()).get('/users/me').set('Authorization', `Bearer ${accessToken}`),
    ]) {
      const response = await authenticated;
      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(JSON.stringify(response.body)).not.toContain(email);
    }

    const refresh = await request(app.getHttpServer())
      .post('/auth/token/refresh')
      .send({ refreshToken });
    expect(refresh.status).toBe(401);
    expect(JSON.stringify(refresh.body)).not.toContain(refreshToken);

    for (const endpoint of ['/auth/login', '/auth/token']) {
      const response = await request(app.getHttpServer()).post(endpoint).send({ email, password });
      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(JSON.stringify(response.body)).not.toContain(email);
    }
  });
});
