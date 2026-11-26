import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import sharp from 'sharp';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Users /me (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let athleteId: string;
  let otherId: string;
  let reviewerId: string;
  let athleteCookie: string;
  let otherCookie: string;
  let adminCookie: string;

  const password = 'StrongPassword123!';
  const suffix = randomUUID();
  const athleteEmail = `user-profile-athlete-${suffix}@example.com`;
  const otherEmail = `user-profile-other-${suffix}@example.com`;
  const adminEmail = `user-profile-admin-${suffix}@example.com`;

  function sessionCookie(header: string | string[] | undefined): string {
    const cookies = Array.isArray(header) ? header : header ? [header] : [];
    const cookie = cookies
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-sid='));
    if (!cookie) throw new Error('Expected a session cookie');
    return cookie;
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    expect(response.status).toBe(200);
    return sessionCookie(response.headers['set-cookie']);
  }

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
    const hasher = app.get(PasswordHasher);
    const hash = await hasher.hash(password);

    const athlete = await prisma.user.create({
      data: {
        email: athleteEmail,
        passwordHash: hash,
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    athleteId = athlete.id;
    const other = await prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: hash,
        role: 'TRAINER',
      },
      select: { id: true },
    });
    otherId = other.id;
    const admin = await prisma.user.create({
      data: { email: adminEmail, passwordHash: hash, role: 'ADMIN' },
      select: { id: true },
    });
    reviewerId = admin.id;

    athleteCookie = await login(athleteEmail);
    otherCookie = await login(otherEmail);
    adminCookie = await login(adminEmail);
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma) {
        const userIds = [athleteId, otherId, reviewerId].filter(Boolean);
        if (userIds.length) {
          await prisma.trainerProfile.deleteMany({ where: { userId: { in: userIds } } });
          await prisma.profile.deleteMany({
            where: { userId: { in: userIds } },
          });
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('requires authentication for both routes', async () => {
    const get = await request(app.getHttpServer()).get('/users/me');
    const patch = await request(app.getHttpServer()).patch('/users/me').send({ name: 'Anonymous' });
    expect(get.status).toBe(401);
    expect(patch.status).toBe(401);
  });

  it('intakes one confirmed deletion request and keeps the receipt private to its owner', async () => {
    const path = '/users/me/account-deletion-request';
    const http = request(app.getHttpServer());
    const input = { password, confirm: true };
    const readOwn = () => http.get(path).set('Cookie', athleteCookie);
    const submitOwn = () => http.post(path).set('Cookie', athleteCookie);

    await http.get(path).expect(401);
    await http.post(path).send(input).expect(401);
    expect((await readOwn().expect('Cache-Control', 'no-store').expect(200)).body).toEqual({
      request: null,
    });
    await submitOwn()
      .send({ ...input, confirm: false })
      .expect(400);
    await submitOwn()
      .send({ ...input, userId: otherId })
      .expect(400);
    await submitOwn().set('Origin', 'https://untrusted.example.test').send(input).expect(401);
    await submitOwn()
      .send({ ...input, password: 'WrongPassword!' })
      .expect(403);
    expect(await prisma.accountDeletionRequest.count({ where: { userId: athleteId } })).toBe(0);

    const tokens = await http
      .post('/auth/token')
      .send({ email: athleteEmail, password })
      .expect(200);
    const accessToken = tokens.body.accessToken as string;
    const [first, duplicate] = await Promise.all([
      submitOwn().send(input).expect('Cache-Control', 'no-store').expect(200),
      http.post(path).set('Authorization', `Bearer ${accessToken}`).send(input).expect(200),
    ]);
    const stored = await prisma.accountDeletionRequest.findUniqueOrThrow({
      where: { userId: athleteId },
    });
    const expected = {
      request: {
        id: stored.id,
        requestedAt: stored.requestedAt.toISOString(),
        status: 'REQUESTED',
      },
    };
    expect(first.body).toEqual(expected);
    expect(duplicate.body).toEqual(expected);
    expect((await readOwn().expect(200)).body).toEqual(expected);
    expect((await http.get(path).set('Cookie', otherCookie).expect(200)).body).toEqual({
      request: null,
    });
    // Password confirmation is limited per owner even with the generic IP
    // throttler disabled in this suite. Receipt reads stay available.
    await submitOwn().send(input).expect(429);
    await readOwn().expect(200);
    await http.get('/users/me').set('Cookie', athleteCookie).expect(200);
  });

  it('reads fresh grants from the current actor, not a stale session role', async () => {
    const anonymous = await request(app.getHttpServer()).get('/users/me/capabilities');
    expect(anonymous.status).toBe(401);

    const own = () =>
      request(app.getHttpServer()).get('/users/me/capabilities').set('Cookie', athleteCookie);

    const initial = await own();
    expect(initial.status).toBe(200);
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.body).toEqual({ athlete: true, trainer: false, admin: false });

    const legacy = await request(app.getHttpServer())
      .get('/users/me/capabilities')
      .set('Cookie', otherCookie);
    expect(legacy.status).toBe(200);
    expect(legacy.body).toEqual({ athlete: true, trainer: true, admin: false });

    const admin = await request(app.getHttpServer())
      .get('/users/me/capabilities')
      .set('Cookie', adminCookie);
    expect(admin.status).toBe(200);
    expect(admin.body).toEqual({ athlete: false, trainer: false, admin: true });

    await prisma.trainerProfile.create({
      data: { userId: athleteId, isActive: true, approvedAt: new Date(), approvedById: reviewerId },
    });
    try {
      const approved = await own();
      expect(approved.status).toBe(200);
      expect(approved.body).toEqual({ athlete: true, trainer: true, admin: false });
      expect(approved.body).not.toHaveProperty('role');
      expect(approved.body).not.toHaveProperty('trainerProfile');

      await prisma.trainerProfile.update({
        where: { userId: athleteId },
        data: { isActive: false, revokedAt: new Date(), revokedById: reviewerId },
      });
      const revoked = await own();
      expect(revoked.status).toBe(200);
      expect(revoked.body).toEqual({ athlete: true, trainer: false, admin: false });
    } finally {
      await prisma.trainerProfile.deleteMany({ where: { userId: athleteId } });
    }
  });

  it('enforces live trainer access on training-program reads after approval and revocation', async () => {
    const list = (cookie: string) =>
      request(app.getHttpServer())
        .get('/training-programs')
        .query({ page: 1, limit: 10 })
        .set('Cookie', cookie);

    expect((await request(app.getHttpServer()).get('/training-programs')).status).toBe(401);
    expect((await list(athleteCookie)).status).toBe(403);
    expect((await list(adminCookie)).status).toBe(403);
    expect((await list(otherCookie)).status).toBe(200);

    await prisma.trainerProfile.create({
      data: { userId: athleteId, isActive: true, approvedAt: new Date(), approvedById: reviewerId },
    });
    try {
      const approved = await list(athleteCookie);
      expect(approved.status).toBe(200);

      await prisma.trainerProfile.update({
        where: { userId: athleteId },
        data: { isActive: false, revokedAt: new Date(), revokedById: reviewerId },
      });
      expect((await list(athleteCookie)).status).toBe(403);

      // Explicit revocation overrides the legacy TRAINER role without invalidating the session.
      await prisma.trainerProfile.create({
        data: {
          userId: otherId,
          isActive: false,
          revokedAt: new Date(),
          revokedById: reviewerId,
        },
      });
      expect((await list(otherCookie)).status).toBe(403);
    } finally {
      await prisma.trainerProfile.deleteMany({
        where: { userId: { in: [athleteId, otherId] } },
      });
    }
  });

  it('keeps Athlete workouts and analytics across legacy TRAINER, approval and revocation without IDOR', async () => {
    const ownerWorkout = await prisma.workout.create({
      data: {
        title: 'Cross-product owner workout',
        athlete: { connect: { id: athleteId } },
        createdBy: { connect: { id: athleteId } },
      },
      select: { id: true },
    });
    const foreignWorkout = await prisma.workout.create({
      data: {
        title: 'Cross-product foreign workout',
        athlete: { connect: { id: otherId } },
        createdBy: { connect: { id: otherId } },
      },
      select: { id: true },
    });
    const http = app.getHttpServer();

    const me = () => request(http).get('/users/me').set('Cookie', athleteCookie);
    const grants = () => request(http).get('/users/me/capabilities').set('Cookie', athleteCookie);
    const workouts = () =>
      request(http).get('/workouts').query({ page: 1, limit: 20 }).set('Cookie', athleteCookie);
    const analytics = () =>
      request(http)
        .get('/workout-analytics/summary')
        .query({ range: '7d' })
        .set('Cookie', athleteCookie);
    const trainerPrograms = () =>
      request(http)
        .get('/training-programs')
        .query({ page: 1, limit: 20 })
        .set('Cookie', athleteCookie);

    try {
      const initial = await me();
      expect(initial.status).toBe(200);
      expect(initial.body).toMatchObject({ id: athleteId, role: 'ATHLETE' });
      expect(initial.body).not.toHaveProperty('passwordHash');

      const selfGrant = await request(http)
        .patch('/users/me')
        .set('Cookie', athleteCookie)
        .send({ role: 'TRAINER' });
      expect(selfGrant.status).toBe(400);

      const own = await workouts();
      expect(own.status).toBe(200);
      expect(own.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: ownerWorkout.id })]),
      );
      expect(own.body.data).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: foreignWorkout.id })]),
      );
      const foreign = await request(http)
        .get(`/workouts/${foreignWorkout.id}`)
        .set('Cookie', athleteCookie);
      expect(foreign.status).toBe(404);
      expect((await analytics()).status).toBe(200);
      expect((await trainerPrograms()).status).toBe(403);

      // An already-issued ATHLETE session must survive a legacy TRAINER role
      // migration and still permit the account to read only its own workouts.
      await prisma.user.update({ where: { id: athleteId }, data: { role: 'TRAINER' } });
      expect((await me()).body).toMatchObject({ id: athleteId, role: 'TRAINER' });
      expect((await grants()).body).toEqual({ athlete: true, trainer: true, admin: false });
      expect((await workouts()).status).toBe(200);
      expect((await analytics()).status).toBe(200);
      expect((await trainerPrograms()).status).toBe(200);
      expect(
        (await request(http).get(`/workouts/${foreignWorkout.id}`).set('Cookie', athleteCookie))
          .status,
      ).toBe(404);

      // The same session next sees two capabilities with a persisted ATHLETE
      // role (onboarding approval does not rewrite the legacy role).
      await prisma.user.update({ where: { id: athleteId }, data: { role: 'ATHLETE' } });
      await prisma.trainerProfile.create({
        data: {
          userId: athleteId,
          isActive: true,
          approvedAt: new Date(),
          approvedById: reviewerId,
        },
      });
      expect((await me()).body).toMatchObject({ id: athleteId, role: 'ATHLETE' });
      expect((await grants()).body).toEqual({ athlete: true, trainer: true, admin: false });
      expect((await workouts()).status).toBe(200);
      expect((await analytics()).status).toBe(200);
      expect((await trainerPrograms()).status).toBe(200);

      await prisma.trainerProfile.update({
        where: { userId: athleteId },
        data: { isActive: false, revokedAt: new Date(), revokedById: reviewerId },
      });
      expect((await grants()).body).toEqual({ athlete: true, trainer: false, admin: false });
      expect((await workouts()).status).toBe(200);
      expect((await analytics()).status).toBe(200);
      expect((await trainerPrograms()).status).toBe(403);

      // An admin promotion must take effect immediately even when the session
      // still carries its old ATHLETE identity.
      await prisma.user.update({ where: { id: athleteId }, data: { role: 'ADMIN' } });
      expect((await grants()).body).toEqual({ athlete: false, trainer: false, admin: true });
      expect((await workouts()).status).toBe(403);
      expect((await analytics()).status).toBe(403);
      expect((await trainerPrograms()).status).toBe(403);
    } finally {
      await prisma.workout.deleteMany({
        where: { id: { in: [ownerWorkout.id, foreignWorkout.id] } },
      });
      await prisma.trainerProfile.deleteMany({ where: { userId: athleteId } });
      await prisma.user.update({ where: { id: athleteId }, data: { role: 'ATHLETE' } });
    }
  }, 35_000);

  it('returns current account with null profile and no secrets', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', athleteCookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: athleteId,
      email: athleteEmail,
      role: 'ATHLETE',
      emailVerified: false,
      profile: null,
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('deletedAt');
  });

  it('creates profile on first PATCH and returns date-only birthday', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({
        name: '  Athlete One  ',
        birthday: '1998-03-04',
        height: 193,
        weight: 81.25,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: athleteId,
      profile: {
        name: 'Athlete One',
        birthday: '1998-03-04',
        height: 193,
        weight: 81.25,
      },
    });
    expect(response.body.profile).not.toHaveProperty('userId');

    const stored = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
    });
    expect(stored.birthday?.toISOString().slice(0, 10)).toBe('1998-03-04');
    expect(stored.weight?.toFixed(2)).toBe('81.25');
  });

  it('updates only specified fields and leaves other fields unchanged', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({ weight: 82.75 });

    expect(response.status).toBe(200);
    expect(response.body.profile).toMatchObject({
      name: 'Athlete One',
      birthday: '1998-03-04',
      height: 193,
      weight: 82.75,
    });
  });

  it('allows clearing nullable fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({ name: null, birthday: null });

    expect(response.status).toBe(200);
    expect(response.body.profile).toMatchObject({
      name: null,
      birthday: null,
      height: 193,
      weight: 82.75,
    });
  });

  it('rejects account/role edits, empty bodies and invalid values', async () => {
    for (const body of [
      {},
      { role: 'ADMIN' },
      { email: 'new@example.com' },
      { passwordHash: 'malicious' },
      { birthday: '2100-01-01' },
      { height: 1000 },
      { weight: 80.555 },
      { name: '   ' },
    ]) {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Cookie', athleteCookie)
        .send(body);
      expect(response.status).toBe(400);
    }
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: athleteId },
      select: { role: true, email: true },
    });
    expect(account).toEqual({ role: 'ATHLETE', email: athleteEmail });
  });

  it('isolates profiles between authenticated users', async () => {
    const otherUpdate = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', otherCookie)
      .send({ name: 'Trainer', height: 185 });
    expect(otherUpdate.status).toBe(200);
    expect(otherUpdate.body).toMatchObject({
      id: otherId,
      role: 'TRAINER',
      profile: { name: 'Trainer', height: 185 },
    });

    const athlete = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', athleteCookie);
    expect(athlete.body.id).toBe(athleteId);
    expect(athlete.body.profile).toMatchObject({ name: null, height: 193, weight: 82.75 });
    expect(athlete.body.profile).not.toMatchObject({ name: 'Trainer' });
  });

  it('updates all new profile fields without changing existing metrics', async () => {
    const url = 'https://cdn.example.com/avatars/athlete-1.webp';
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({
        firstName: '  Anna ',
        lastName: ' Smith ',
        displayName: ' Anna S. ',
        avatarUrl: url,
        timezone: 'Europe/Kyiv',
      });

    expect(response.status).toBe(200);
    expect(response.body.profile).toMatchObject({
      name: 'Anna S.',
      firstName: 'Anna',
      lastName: 'Smith',
      displayName: 'Anna S.',
      avatarUrl: url,
      timezone: 'Europe/Kyiv',
      height: 193,
      weight: 82.75,
    });

    const stored = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
    });
    expect(stored.name).toBe('Anna S.');
    expect(stored.displayName).toBe('Anna S.');
    expect(stored.firstName).toBe('Anna');
    expect(stored.lastName).toBe('Smith');
  });

  it('preserves the legacy name PATCH contract and syncs displayName', async () => {
    const legacy = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({ name: 'Legacy Nick' });

    expect(legacy.status).toBe(200);
    expect(legacy.body.profile).toMatchObject({
      name: 'Legacy Nick',
      displayName: 'Legacy Nick',
      firstName: 'Anna',
      lastName: 'Smith',
      timezone: 'Europe/Kyiv',
    });

    const cleared = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({ displayName: null, avatarUrl: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.profile).toMatchObject({
      name: null,
      displayName: null,
      avatarUrl: null,
      firstName: 'Anna',
      lastName: 'Smith',
      timezone: 'Europe/Kyiv',
    });
  });

  it('rejects invalid avatar links, time zones and mismatched names', async () => {
    for (const body of [
      { avatarUrl: 'http://insecure.example.com/photo.png' },
      { avatarUrl: 'javascript:alert(1)' },
      { avatarUrl: 'https://name:secret@example.com/photo.png' },
      { timezone: 'Europe/InvalidCity' },
      { timezone: null },
      { name: 'Old', displayName: 'New' },
      { firstName: '   ' },
      { lastName: '   ' },
    ]) {
      const result = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Cookie', athleteCookie)
        .send(body);
      expect(result.status).toBe(400);
    }
  });

  it('uploads, serves, replaces and deletes a managed avatar', async () => {
    const png = await sharp({
      create: { width: 1, height: 1, channels: 4, background: 'white' },
    })
      .png()
      .toBuffer();

    const first = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .attach('file', png, { filename: 'profile.png', contentType: 'image/png' });

    expect(first.status).toBe(200);
    expect(first.body.avatarUrl).toMatch(new RegExp('^/avatars/[0-9a-f-]+[.]png$'));
    const firstUrl: string = first.body.avatarUrl;

    const stored = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
      select: { avatarUrl: true, avatarKey: true },
    });
    expect(stored.avatarUrl).toBe(firstUrl);
    expect(stored.avatarKey).toBe(firstUrl.split('/').at(-1));

    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', athleteCookie);
    expect(profile.body.profile.avatarUrl).toBe(firstUrl);
    expect(profile.body.profile).not.toHaveProperty('avatarKey');

    const publicResponse = await request(app.getHttpServer()).get(firstUrl);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers['content-type']).toContain('image/png');
    expect(publicResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(publicResponse.headers['cache-control']).toBe('no-store');

    const second = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .attach('file', png, { filename: 'other.png', contentType: 'image/png' });

    expect(second.status).toBe(200);
    expect(second.body.avatarUrl).not.toBe(firstUrl);
    expect((await request(app.getHttpServer()).get(firstUrl)).status).toBe(404);
    expect((await request(app.getHttpServer()).get(second.body.avatarUrl)).status).toBe(200);

    const removed = await request(app.getHttpServer())
      .delete('/users/me/avatar')
      .set('Cookie', athleteCookie);

    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ avatarUrl: null });
    expect((await request(app.getHttpServer()).get(second.body.avatarUrl)).status).toBe(404);

    const after = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
      select: { avatarKey: true, avatarUrl: true },
    });
    expect(after).toEqual({ avatarKey: null, avatarUrl: null });
  });

  it('serves a resized JPEG without source EXIF metadata', async () => {
    const original = await sharp({
      create: { width: 1024, height: 640, channels: 3, background: 'blue' },
    })
      .withExif({ IFD0: { ImageDescription: 'PRIVATE-METADATA' } })
      .jpeg()
      .toBuffer();

    expect((await sharp(original).metadata()).exif).toBeDefined();

    const upload = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .attach('file', original, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
    expect(upload.status).toBe(200);
    expect(upload.body.avatarUrl).toMatch(new RegExp('^/avatars/[0-9a-f-]+[.]jpg$'));

    const result = await request(app.getHttpServer()).get(upload.body.avatarUrl);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.isBuffer(result.body)).toBe(true);

    const metadata = await sharp(result.body as Buffer).metadata();
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    expect(metadata.exif).toBeUndefined();
    expect((result.body as Buffer).includes(Buffer.from('PRIVATE-METADATA'))).toBe(false);

    await request(app.getHttpServer())
      .delete('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .expect(200);
  });

  it('rejects corrupted image data after a superficially valid header', async () => {
    const png = await sharp({
      create: { width: 1, height: 1, channels: 4, background: 'white' },
    })
      .png()
      .toBuffer();
    const truncated = png.subarray(0, 33);

    const response = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .attach('file', truncated, {
        filename: 'apparently-valid.png',
        contentType: 'image/png',
      });
    expect(response.status).toBe(400);

    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
      select: { avatarKey: true, avatarUrl: true },
    });
    expect(profile).toEqual({ avatarKey: null, avatarUrl: null });
  });

  it('rejects malformed image bytes, large files, and unauthorized uploads', async () => {
    const fakeImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const unauthorized = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .attach('file', fakeImage, { filename: 'image.png', contentType: 'image/png' });
    expect(unauthorized.status).toBe(401);

    const wrongMagic = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .attach('file', fakeImage, { filename: 'image.png', contentType: 'image/png' });
    expect(wrongMagic.status).toBe(400);

    const oversized = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 10), {
        filename: 'image.png',
        contentType: 'image/png',
      });
    expect([400, 413]).toContain(oversized.status);

    const missing = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Cookie', athleteCookie)
      .send();
    expect(missing.status).toBe(400);

    const result = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
      select: { avatarUrl: true, avatarKey: true },
    });
    expect(result).toEqual({ avatarUrl: null, avatarKey: null });
  });

  it('keeps externally hosted avatar URLs compatible with PATCH', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', athleteCookie)
      .send({ avatarUrl: 'https://cdn.example.com/avatar/legacy.png' });
    expect(response.status).toBe(200);
    expect(response.body.profile.avatarUrl).toBe('https://cdn.example.com/avatar/legacy.png');
    const state = await prisma.profile.findUniqueOrThrow({
      where: { userId: athleteId },
      select: { avatarUrl: true, avatarKey: true },
    });
    expect(state).toEqual({
      avatarUrl: 'https://cdn.example.com/avatar/legacy.png',
      avatarKey: null,
    });
  });

  it('persists an authenticated locale preference without modifying another account', async () => {
    const initial = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', athleteCookie)
      .expect(200);
    expect(initial.body.preferredLocale).toBeNull();

    const updated = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .set('Cookie', athleteCookie)
      .send({ preferredLocale: 'en' })
      .expect(200);
    expect(updated.body).toMatchObject({ id: athleteId, preferredLocale: 'en' });
    expect(updated.body).not.toHaveProperty('passwordHash');

    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: athleteId },
      select: { preferredLocale: true },
    });
    expect(persisted.preferredLocale).toBe('en');

    const other = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', otherCookie)
      .expect(200);
    expect(other.body).toMatchObject({ id: otherId, preferredLocale: null });

    const cleared = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .set('Cookie', athleteCookie)
      .send({ preferredLocale: null })
      .expect(200);
    expect(cleared.body.preferredLocale).toBeNull();

    const after = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', athleteCookie)
      .expect(200);
    expect(after.body.preferredLocale).toBeNull();
  });

  it('requires authentication and rejects invalid locale preferences', async () => {
    const unauthenticated = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .send({ preferredLocale: 'en' });
    expect(unauthenticated.status).toBe(401);

    for (const body of [
      {},
      { preferredLocale: 'en-US' },
      { preferredLocale: 'fr' },
      { preferredLocale: 'en', role: 'ADMIN' },
    ]) {
      const response = await request(app.getHttpServer())
        .patch('/users/me/preferences')
        .set('Cookie', athleteCookie)
        .send(body);
      expect(response.status).toBe(400);
    }

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: athleteId },
      select: { preferredLocale: true, role: true },
    });
    expect(stored).toEqual({ preferredLocale: null, role: 'ATHLETE' });
  });

  it('stores independent account workout preferences without changing locale or exposing them to other users', async () => {
    const path = '/users/me/preferences/workouts';
    const http = request(app.getHttpServer());
    await http.get(path).expect(401);
    await http.patch(path).send({ autoRestTimer: false }).expect(401);
    const own = () => http.get(path).set('Cookie', athleteCookie);
    const patch = (body: object) => http.patch(path).set('Cookie', athleteCookie).send(body);
    const initial = { autoRestTimer: null, restDurationSeconds: null };
    expect((await own().expect('Cache-Control', 'no-store').expect(200)).body).toEqual(initial);
    for (const body of [
      {},
      { autoRestTimer: null },
      { restDurationSeconds: 91 },
      { restDurationSeconds: '90' },
      { autoRestTimer: false, userId: otherId },
      { restSound: false },
    ]) {
      await patch(body).expect(400);
    }
    expect((await own().expect(200)).body).toEqual(initial);
    await expect(
      prisma.user.update({ where: { id: athleteId }, data: { restDurationSeconds: 91 } }),
    ).rejects.toThrow();
    expect(
      (await patch({ autoRestTimer: false }).expect('Cache-Control', 'no-store').expect(200)).body,
    ).toEqual({ autoRestTimer: false, restDurationSeconds: null });
    expect((await patch({ restDurationSeconds: 120 }).expect(200)).body).toEqual({
      autoRestTimer: false,
      restDurationSeconds: 120,
    });
    await Promise.all([
      patch({ autoRestTimer: true }).expect(200),
      patch({ restDurationSeconds: 60 }).expect(200),
    ]);
    expect((await own().expect(200)).body).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 60,
    });
    expect((await http.get(path).set('Cookie', otherCookie).expect(200)).body).toEqual(initial);
    const legacy = await http
      .patch('/users/me/preferences')
      .set('Cookie', athleteCookie)
      .send({ preferredLocale: 'en' })
      .expect(200);
    expect(legacy.body.preferredLocale).toBe('en');
    expect(legacy.body).not.toHaveProperty('autoRestTimer');
    expect(legacy.body).not.toHaveProperty('restDurationSeconds');
    expect((await own().expect(200)).body).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 60,
    });
    await http
      .patch('/users/me/preferences')
      .set('Cookie', athleteCookie)
      .send({ preferredLocale: null })
      .expect(200);
  });

  it('initializes only missing explicit workout preferences, safely across retries and concurrent devices', async () => {
    const path = '/users/me/preferences/workouts';
    const http = request(app.getHttpServer());
    const init = (body: object, cookie = otherCookie) =>
      http
        .post(path + '/initialize')
        .set('Cookie', cookie)
        .send(body);
    const read = (cookie = otherCookie) => http.get(path).set('Cookie', cookie);
    const patch = (body: object) => http.patch(path).set('Cookie', otherCookie).send(body);
    const initial = { autoRestTimer: null, restDurationSeconds: null };
    await http
      .post(path + '/initialize')
      .send({ autoRestTimer: false })
      .expect(401);
    expect((await read().expect(200)).body).toEqual(initial);
    for (const body of [
      {},
      { autoRestTimer: null },
      { autoRestTimer: 'false' },
      { restDurationSeconds: '90' },
      { restDurationSeconds: 91 },
      { autoRestTimer: false, userId: athleteId },
      { restSound: true },
    ]) {
      await init(body).expect(400);
    }
    expect((await read().expect(200)).body).toEqual(initial);
    expect(
      (await init({ autoRestTimer: false }).expect('Cache-Control', 'no-store').expect(200)).body,
    ).toEqual({ autoRestTimer: false, restDurationSeconds: null });
    const mixed = await init({ autoRestTimer: true, restDurationSeconds: 120 }).expect(200);
    expect(mixed.body).toEqual({ autoRestTimer: false, restDurationSeconds: 120 });
    const beforeRetry = await prisma.user.findUniqueOrThrow({
      where: { id: otherId },
      select: { updatedAt: true },
    });
    expect((await init({ autoRestTimer: true, restDurationSeconds: 60 }).expect(200)).body).toEqual(
      mixed.body,
    );
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: otherId }, select: { updatedAt: true } }),
    ).toEqual(beforeRetry);
    expect((await read(athleteCookie).expect(200)).body).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 60,
    });

    // Reset only our test fixture to simulate two devices migrating simultaneously.
    await prisma.user.update({ where: { id: otherId }, data: initial });
    const [first, second] = await Promise.all([
      init({ autoRestTimer: false, restDurationSeconds: 60 }).expect(200),
      init({ autoRestTimer: true, restDurationSeconds: 120 }).expect(200),
    ]);
    expect(second.body).toEqual(first.body);
    expect([
      { autoRestTimer: false, restDurationSeconds: 60 },
      { autoRestTimer: true, restDurationSeconds: 120 },
    ]).toContainEqual(first.body);
    expect((await read().expect(200)).body).toEqual(first.body);

    await prisma.user.update({ where: { id: otherId }, data: initial });
    await Promise.all([
      init({ autoRestTimer: false }).expect(200),
      init({ restDurationSeconds: 120 }).expect(200),
    ]);
    expect((await read().expect(200)).body).toEqual({
      autoRestTimer: false,
      restDurationSeconds: 120,
    });

    await prisma.user.update({ where: { id: otherId }, data: initial });
    await Promise.all([
      init({ autoRestTimer: false, restDurationSeconds: 60 }).expect(200),
      patch({ autoRestTimer: true, restDurationSeconds: 90 }).expect(200),
    ]);
    expect((await read().expect(200)).body).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 90,
    });
    expect(
      (await init({ autoRestTimer: false, restDurationSeconds: 120 }).expect(200)).body,
    ).toEqual({ autoRestTimer: true, restDurationSeconds: 90 });
  });

  it('rejects a soft-deleted account even with an existing session', async () => {
    await prisma.user.update({
      where: { id: otherId },
      data: { deletedAt: new Date() },
    });

    const result = await request(app.getHttpServer()).get('/users/me').set('Cookie', otherCookie);
    expect(result.status).toBe(401);
    await request(app.getHttpServer())
      .get('/users/me/preferences/workouts')
      .set('Cookie', otherCookie)
      .expect(401);
    await request(app.getHttpServer())
      .patch('/users/me/preferences/workouts')
      .set('Cookie', otherCookie)
      .send({ autoRestTimer: false })
      .expect(401);
    await request(app.getHttpServer())
      .post('/users/me/preferences/workouts/initialize')
      .set('Cookie', otherCookie)
      .send({ autoRestTimer: false })
      .expect(401);
  });
});
