import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { MfaService, PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { AccountDeletionRequestsService } from '../../../src/modules/account-deletion-requests/public-api.js';
import { AccountDeletionRequestsRepository } from '../../../src/modules/account-deletion-requests/repositories/account-deletion-requests.repository.js';
import { AdminMfaEnrollmentService } from '../../../src/modules/auth/services/admin-mfa-enrollment.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';
import { codeAt } from '../../utility/totp-code.js';

function cookie(header: string | string[] | undefined, name: string): string {
  const values = Array.isArray(header) ? header : header ? [header] : [];
  const value = values.find((entry) => entry.startsWith(name + '='))?.split(';')[0];
  if (!value) throw new Error('Expected session cookie');
  return value;
}

describe('Account deletion confirmation during staged MFA rollout (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = randomUUID();
  const email = `deletion-mfa-${userId}@example.test`;
  const password = 'Test-only confirmation password!';
  const path = '/users/me/account-deletion-request';

  beforeAll(async () => {
    useTestDatabase();
    // Keep the registered MFA provider and all authentication stores unchanged.
    // Disable only the outer IP quota to isolate the real account-level budget.
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        id: userId,
        email,
        passwordHash: await app.get(PasswordHasher).hash(password),
        emailVerified: true,
        role: 'ADMIN',
      },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma?.outboxEvent.deleteMany({ where: { actorUserId: userId } });
      await prisma?.mfaLifecycleAudit.deleteMany({ where: { userId } });
      await prisma?.user.deleteMany({ where: { id: userId } });
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('rejects confirmed accounts independently of the global verifier and Admin keyring', async () => {
    const http = request(app.getHttpServer());
    const input = { confirm: true as const, password };
    const login = await http.post('/auth/login').send({ email, password }).expect(200);
    const ordinary = cookie(login.headers['set-cookie'], '__Host-sid');
    const token = await http.post('/auth/token').send({ email, password }).expect(200);
    const bearer = 'Bearer ' + String(token.body.accessToken);
    const admin = await http.post('/auth/admin-login').send({ email, password }).expect(200);
    const adminCookie = cookie(admin.headers['set-cookie'], '__Host-admin-sid');
    const sessionId = createHash('sha256')
      .update(adminCookie.split('=', 2)[1]!)
      .digest('base64url');
    const config = app.get(ConfigService);
    const keyring = randomBytes(32).toString('base64url');
    config.set('MFA_ENCRYPTION_KEYS', keyring);
    const enrollment = app.get(AdminMfaEnrollmentService);
    const principal = { userId, sessionId };
    const staged = await enrollment.begin(principal, password);
    await http.get(path).set('Cookie', ordinary).expect(200);
    await http.post(path).set('Cookie', adminCookie).send(input).expect(401);

    expect(await enrollment.confirm(principal, codeAt(staged.secret))).not.toBeNull();
    expect(await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { userId } })).toMatchObject({
      confirmed: true,
      secret: expect.stringMatching(/^v1\./),
    });
    expect(await app.get(MfaService).isEnrolled(userId)).toBe(false);

    // Even if a caller has a current credential snapshot, the persistence
    // boundary must independently reject an enrolled owner under the lock.
    const repository = app.get(AccountDeletionRequestsRepository);
    const current = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, authInvalidatedAt: true },
    });
    await expect(repository.submit(userId, current)).resolves.toBeNull();

    const service = app.get(AccountDeletionRequestsService);
    await expect(service.submit(userId, input)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.submit(userId, { ...input, totpCode: codeAt(staged.secret) }),
    ).rejects.toMatchObject({ status: 403 });
    config.set('MFA_ENCRYPTION_KEYS', undefined);
    await expect(
      service.submit(userId, { ...input, totpCode: codeAt(staged.secret) }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.submit(userId, input)).rejects.toMatchObject({ status: 429 });

    await http.get(path).set('Cookie', ordinary).expect(401);
    await http.post(path).set('Cookie', ordinary).send(input).expect(401);
    await http.get(path).set('Authorization', bearer).expect(401);
    await http.post(path).set('Authorization', bearer).send(input).expect(401);
    await http.post('/auth/login').send({ email, password }).expect(401);
    expect(await prisma.accountDeletionRequest.count({ where: { userId } })).toBe(0);
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true, deletedAt: true },
      }),
    ).toEqual({ status: 'ACTIVE', deletedAt: null });
  }, 20_000);
});
