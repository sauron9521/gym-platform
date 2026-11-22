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

describe('GET /admin/users (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const operatorId = randomUUID();
  const priorAllowlist = process.env.SUPERADMIN_USER_IDS;
  const suffix = randomUUID();
  const password = 'StrongPassword123!';
  const ids: string[] = [];
  const cookies: Record<string, string> = {};

  async function seedAccount(
    key: string,
    role: 'ATHLETE' | 'TRAINER' | 'ADMIN',
    deletedAt?: Date,
    id = randomUUID(),
  ) {
    const email = `admin-list-${key}-${suffix}@example.test`;
    const hash = await app.get(PasswordHasher).hash(password);
    const account = await prisma.user.create({
      data: {
        id,
        email,
        role,
        passwordHash: hash,
        emailVerified: true,
        ...(deletedAt ? { deletedAt } : {}),
      },
      select: { id: true, email: true },
    });
    ids.push(account.id);
    if (!deletedAt) {
      const signIn = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
      expect(signIn.status).toBe(200);
      const raw = signIn.headers['set-cookie'];
      const setCookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const cookie = setCookies
        .map((value) => value.split(';', 1)[0] ?? '')
        .find((value) => value.startsWith('__Host-sid='));
      if (!cookie) throw new Error('Expected session cookie');
      cookies[key] = cookie;
    }
    return account;
  }

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

    await seedAccount('operator', 'ADMIN', undefined, operatorId);
    await seedAccount('plain-admin', 'ADMIN');
    await seedAccount('athlete', 'ATHLETE');
    await seedAccount('trainer', 'TRAINER');
    const suspended = await seedAccount('suspended', 'ATHLETE');
    await prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    await seedAccount('deleted', 'ATHLETE', new Date());
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && ids.length) {
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await app?.close();
      if (priorAllowlist === undefined) delete process.env.SUPERADMIN_USER_IDS;
      else process.env.SUPERADMIN_USER_IDS = priorAllowlist;
    }
  }, 20_000);

  const list = (cookie: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer()).get('/admin/users').query(query).set('Cookie', cookie);

  it('rejects anonymous 401 and all non-operator roles 403 without leaking records', async () => {
    const anonymous = await request(app.getHttpServer()).get('/admin/users');
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['cache-control']).toContain('no-store');
    for (const key of ['plain-admin', 'athlete', 'trainer']) {
      const response = await list(cookies[key]!);
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(`admin-list-athlete-${suffix}`);
      expect(response.headers['cache-control']).toContain('no-store');
    }
  });

  it('returns a bounded, minimal privileged list with stable pagination and filters', async () => {
    const url = { search: `admin-list-`, limit: '2', page: '1' };
    const first = await list(cookies.operator!, url);
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toContain('no-store');
    expect(first.body.meta).toMatchObject({
      total: 5,
      skip: 0,
      take: 2,
      totalPages: 3,
    });
    expect(first.body.data).toHaveLength(2);
    for (const record of first.body.data as Record<string, unknown>[]) {
      expect(Object.keys(record).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'status']);
      expect(['ACTIVE', 'SUSPENDED']).toContain(record.status);
      expect(JSON.stringify(record)).not.toContain('passwordHash');
      expect(JSON.stringify(record)).not.toContain('deletedAt');
      expect(JSON.stringify(record)).not.toContain('preferredLocale');
      expect(JSON.stringify(record)).not.toContain('profile');
    }

    const second = await list(cookies.operator!, { ...url, page: '2' });
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(2);
    const ids1 = first.body.data.map((v: { id: string }) => v.id);
    const ids2 = second.body.data.map((v: { id: string }) => v.id);
    expect(new Set([...ids1, ...ids2]).size).toBe(4);

    const trainer = await list(cookies.operator!, {
      search: `admin-list-`,
      role: 'TRAINER',
      status: 'ACTIVE',
    });
    expect(trainer.status).toBe(200);
    expect(trainer.body.data).toHaveLength(1);
    expect(trainer.body.data[0].role).toBe('TRAINER');

    const future = await list(cookies.operator!, {
      createdFrom: '2099-01-01T00:00:00Z',
      search: `admin-list-`,
    });
    expect(future.status).toBe(200);
    expect(future.body.data).toHaveLength(0);
    expect(future.body.meta.total).toBe(0);
  });

  it('reads persisted suspended status via privileged list/detail without exposing credentials', async () => {
    const listResponse = await list(cookies.operator!, {
      search: 'admin-list-',
      status: 'SUSPENDED',
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    const record = listResponse.body.data[0];
    expect(record.status).toBe('SUSPENDED');
    expect(record.email).toContain('admin-list-suspended-');
    expect(Object.keys(record).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'status']);

    const detail = await request(app.getHttpServer())
      .get(`/admin/users/${record.id}`)
      .set('Cookie', cookies.operator!);
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe('SUSPENDED');
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
    expect(JSON.stringify(detail.body)).not.toContain('deletedAt');
    expect(detail.headers['cache-control']).toContain('no-store');
  });

  it('rejects unknown parameters and invalid dates', async () => {
    const invalidQueries: Record<string, string>[] = [
      { limit: '51' },
      { status: 'UNKNOWN' },
      { page: '0' },
      { deletedAt: 'not-null' },
      { createdFrom: '2100-01-01T00:00:00Z', createdTo: '2020-01-01T00:00:00Z' },
    ];
    for (const query of invalidQueries) {
      const response = await list(cookies.operator!, query);
      expect(response.status).toBe(400);
    }
  });

  it('keeps a privileged account detail read minimal and rejects missing or deleted accounts', async () => {
    const target = await prisma.user.findFirstOrThrow({
      where: { email: { contains: `admin-list-trainer-${suffix}` } },
      select: { id: true },
    });
    const response = await request(app.getHttpServer())
      .get(`/admin/users/${target.id}`)
      .set('Cookie', cookies.operator!);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(Object.keys(response.body).sort()).toEqual([
      'createdAt',
      'email',
      'emailVerified',
      'id',
      'role',
      'status',
      'updatedAt',
    ]);
    expect(response.body).toMatchObject({
      id: target.id,
      role: 'TRAINER',
      status: 'ACTIVE',
      emailVerified: true,
    });
    for (const key of ['passwordHash', 'profile', 'preferredLocale', 'deletedAt', 'sessions']) {
      expect(response.body).not.toHaveProperty(key);
    }

    const absent = await request(app.getHttpServer())
      .get(`/admin/users/${randomUUID()}`)
      .set('Cookie', cookies.operator!);
    expect(absent.status).toBe(404);
    expect(absent.headers['cache-control']).toContain('no-store');

    const deleted = await prisma.user.findFirstOrThrow({
      where: { email: { contains: `admin-list-deleted-${suffix}` } },
      select: { id: true },
    });
    const deletedResponse = await request(app.getHttpServer())
      .get(`/admin/users/${deleted.id}`)
      .set('Cookie', cookies.operator!);
    expect(deletedResponse.status).toBe(404);

    const malformed = await request(app.getHttpServer())
      .get('/admin/users/not-a-uuid')
      .set('Cookie', cookies.operator!);
    expect(malformed.status).toBe(400);
  });

  it('rejects anonymous and non-operator detail requests before disclosing existence', async () => {
    const target = await prisma.user.findFirstOrThrow({
      where: { email: { contains: `admin-list-athlete-${suffix}` } },
      select: { id: true },
    });

    const anonymous = await request(app.getHttpServer()).get(`/admin/users/${target.id}`);
    expect(anonymous.status).toBe(401);
    for (const key of ['plain-admin', 'athlete', 'trainer']) {
      for (const id of [target.id, randomUUID()]) {
        const denied = await request(app.getHttpServer())
          .get(`/admin/users/${id}`)
          .set('Cookie', cookies[key]!);
        expect(denied.status).toBe(403);
        expect(JSON.stringify(denied.body)).not.toContain(`admin-list-athlete-${suffix}`);
        expect(denied.headers['cache-control']).toContain('no-store');
      }
    }
  });

  it('revokes privileged read on the very next request if the persisted ADMIN role changes', async () => {
    await prisma.user.update({ where: { id: operatorId }, data: { role: 'ATHLETE' } });
    try {
      const response = await list(cookies.operator!);
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(`admin-list-athlete-${suffix}`);
    } finally {
      await prisma.user.update({ where: { id: operatorId }, data: { role: 'ADMIN' } });
    }
  });
});
