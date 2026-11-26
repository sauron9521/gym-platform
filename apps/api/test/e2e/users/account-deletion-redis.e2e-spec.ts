import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DistributedThrottlerStorage } from '../../../src/common/rate-limit/distributed-throttler.storage.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const redisUrl = process.env.TEST_REDIS_URL;
const redisDescribe = redisUrl ? describe : describe.skip;

redisDescribe('Account deletion quota (two real HTTP apps, PostgreSQL and Redis)', () => {
  const apps: INestApplication[] = [];
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const password = 'Test-only deletion confirmation password!';
  const path = '/users/me/account-deletion-request';
  let prisma: PrismaService;
  let previousRedisUrl: string | undefined;

  const email = (id: string) => `deletion-quota-${id}@example.test`;

  async function makeApp() {
    const { AppModule } = await import('../../../src/app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      // Isolate the account budget from the outer per-IP HTTP quota.
      // Authentication, PostgreSQL and the registered Redis storage are real.
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = module.createNestApplication();
    apps.push(app);
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    return app;
  }

  beforeAll(async () => {
    useTestDatabase();
    previousRedisUrl = process.env.REDIS_URL;
    // AppModule calls ConfigModule.forRoot at import time. Set the URL
    // before loading it so the actual storage uses Redis, not memory.
    process.env.REDIS_URL = redisUrl!;
    const first = await makeApp();
    const second = await makeApp();
    const firstStorage = first.get(DistributedThrottlerStorage);
    const secondStorage = second.get(DistributedThrottlerStorage);
    expect(firstStorage).not.toBe(secondStorage);
    await expect(firstStorage.checkReadiness()).resolves.toBe(true);
    await expect(secondStorage.checkReadiness()).resolves.toBe(true);
    prisma = first.get(PrismaService);
    const passwordHash = await first.get(PasswordHasher).hash(password);
    await prisma.user.createMany({
      data: [ownerId, otherId].map((id) => ({
        id,
        email: email(id),
        passwordHash,
        emailVerified: true,
      })),
    });
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma?.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    } finally {
      try {
        for (const app of apps) await app.close();
      } finally {
        if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
        else process.env.REDIS_URL = previousRedisUrl;
      }
    }
  }, 20_000);

  async function login(app: INestApplication, id: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email(id), password })
      .expect(200);
    const header = response.headers['set-cookie'];
    const values = Array.isArray(header) ? header : header ? [header] : [];
    const cookie = values.find((value) => value.startsWith('__Host-sid='))?.split(';')[0];
    if (!cookie) throw new Error('Expected ordinary session cookie');
    return cookie;
  }

  it('shares three confirmation attempts across replicas and credential types without blocking another owner', async () => {
    const [first, second] = apps as [INestApplication, INestApplication];
    const cookie = await login(first, ownerId);
    const otherCookie = await login(second, otherId);
    const tokens = await request(second.getHttpServer())
      .post('/auth/token')
      .send({ email: email(ownerId), password })
      .expect(200);
    const bearer = 'Bearer ' + String(tokens.body.accessToken);

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) => {
        const app = index % 2 === 0 ? first : second;
        const probe = request(app.getHttpServer()).post(path);
        if (index % 4 < 2) probe.set('Cookie', cookie);
        else probe.set('Authorization', bearer);
        return probe.send({ confirm: true, password: 'Incorrect password!' });
      }),
    );
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([
      403, 403, 403, 429, 429, 429, 429, 429,
    ]);

    for (const app of apps) {
      const http = request(app.getHttpServer());
      await http.post(path).set('Cookie', cookie).send({ confirm: true, password }).expect(429);
      await http
        .post(path)
        .set('Authorization', bearer)
        .send({ confirm: true, password })
        .expect(429);
      expect((await http.get(path).set('Cookie', cookie).expect(200)).body).toEqual({
        request: null,
      });
    }
    expect(await prisma.accountDeletionRequest.count({ where: { userId: ownerId } })).toBe(0);

    const accepted = await request(second.getHttpServer())
      .post(path)
      .set('Cookie', otherCookie)
      .send({ confirm: true, password })
      .expect(200);
    const receipt = await prisma.accountDeletionRequest.findUniqueOrThrow({
      where: { userId: otherId },
    });
    expect(accepted.body).toEqual({
      request: {
        id: receipt.id,
        requestedAt: receipt.requestedAt.toISOString(),
        status: 'REQUESTED',
      },
    });
    expect(
      (await request(first.getHttpServer()).get(path).set('Cookie', otherCookie).expect(200)).body,
    ).toEqual(accepted.body);
    expect(
      await prisma.user.count({
        where: { id: { in: [ownerId, otherId] }, status: 'ACTIVE', deletedAt: null },
      }),
    ).toBe(2);
  }, 20_000);
});
