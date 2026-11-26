import { randomBytes, randomUUID } from 'node:crypto';
import { AuthenticationStorage, MfaService, PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { AccountDeletionRequestsService } from '../../../src/modules/account-deletion-requests/public-api.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';
import { codeAt } from '../../utility/totp-code.js';

describe('Account deletion confirmation with MFA enabled (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = randomUUID();
  const email = `deletion-mfa-${userId}@example.test`;
  const password = 'Test-only confirmation password!';
  const path = '/users/me/account-deletion-request';

  beforeAll(async () => {
    useTestDatabase();
    // Production AppModule deliberately leaves global MFA unconfigured.
    // Enable the real verifier ONLY in this test; use the real registered Prisma store.
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MfaService)
      .useFactory({
        inject: [AuthenticationStorage],
        factory: (storage: AuthenticationStorage) =>
          new MfaService(storage, {
            mfa: { encryption: { keys: [randomBytes(32)], migratePlaintext: false }, window: 1 },
          }),
      })
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
      },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma?.user.deleteMany({ where: { id: userId } });
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('denies ordinary HTTP access after enrollment and requires fresh TOTP in the enabled service', async () => {
    const http = request(app.getHttpServer());
    // The existing ordinary session must not authorize an enrolled account.
    const login = await http.post('/auth/login').send({ email, password }).expect(200);
    const header = login.headers['set-cookie'];
    const oldCookie = (Array.isArray(header) ? header : [header])
      .find((value) => value?.startsWith('__Host-sid='))
      ?.split(';')[0];
    if (!oldCookie) throw new Error('Expected ordinary session cookie');
    const mfa = app.get(MfaService);
    const { secret } = await mfa.enroll(userId, email);
    expect(await mfa.confirm(userId, codeAt(secret, Math.floor(Date.now() / 30_000) - 1))).toBe(
      true,
    );
    expect(await mfa.isEnrolled(userId)).toBe(true);
    expect(await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { userId } })).toMatchObject({
      confirmed: true,
      secret: expect.stringMatching(/^v1\./),
    });
    await http.get(path).set('Cookie', oldCookie).expect(401);
    await http.post(path).set('Cookie', oldCookie).send({ confirm: true, password }).expect(401);
    await http.post('/auth/login').send({ email, password }).expect(401);
    expect(await prisma.accountDeletionRequest.count({ where: { userId } })).toBe(0);

    // The ordinary credential gate intentionally prevents enrolled users from
    // reaching this HTTP adapter. Exercise the future enabled confirmation
    // branch using the actual application service, encrypted factor and quota.
    const service = app.get(AccountDeletionRequestsService);
    const body = { confirm: true as const, password };
    await expect(service.submit(userId, body)).rejects.toMatchObject({ status: 403 });
    const step = Math.floor(Date.now() / 30_000);
    const valid = new Set([-2, -1, 0, 1, 2].map((offset) => codeAt(secret, step + offset)));
    const wrong = Array.from({ length: 10 }, (_, digit) => String(digit).repeat(6)).find(
      (code) => !valid.has(code),
    )!;
    await expect(service.submit(userId, { ...body, totpCode: wrong })).rejects.toMatchObject({
      status: 403,
    });
    expect(await prisma.accountDeletionRequest.count({ where: { userId } })).toBe(0);
    const accepted = await service.submit(userId, { ...body, totpCode: codeAt(secret) });
    const receipt = await prisma.accountDeletionRequest.findUniqueOrThrow({ where: { userId } });
    expect(accepted).toEqual({
      request: { id: receipt.id, requestedAt: receipt.requestedAt, status: 'REQUESTED' },
    });
    await expect(service.submit(userId, body)).rejects.toMatchObject({ status: 429 });
    await expect(service.findOwn(userId)).resolves.toEqual(accepted);
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true, deletedAt: true },
      }),
    ).toEqual({ status: 'ACTIVE', deletedAt: null });
  });
});
