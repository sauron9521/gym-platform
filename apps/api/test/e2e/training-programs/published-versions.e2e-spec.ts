import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Published training program versions (HTTP + PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const programIds: string[] = [];
  const password = 'PublishedVersions123!';
  let ownerCookie: string;
  let otherTrainerCookie: string;
  let athleteCookie: string;
  let emptyProgramId: string;
  let oneVersionProgramId: string;
  let largeProgramId: string;

  const publishedPath = (programId: string) => `/training-programs/${programId}/published-versions`;

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
    const http = request(app.getHttpServer());

    async function createSignedInUser(role: 'TRAINER' | 'ATHLETE') {
      const email = `published-versions-${randomUUID()}@example.test`;
      const { id } = await prisma.user.create({ data: { email, passwordHash, role } });
      userIds.push(id);
      const login = await http.post('/auth/login').send({ email, password }).expect(200);
      const header: string[] | string | undefined = login.headers['set-cookie'];
      const cookies = typeof header === 'string' ? [header] : (header ?? []);
      const session = cookies.find((value) => value.startsWith('__Host-sid='));
      if (!session) throw new Error('Session cookie was not set');
      return { id, cookie: session.split(';', 1)[0]! };
    }

    const owner = await createSignedInUser('TRAINER');
    ownerCookie = owner.cookie;
    otherTrainerCookie = (await createSignedInUser('TRAINER')).cookie;
    athleteCookie = (await createSignedInUser('ATHLETE')).cookie;

    async function createProgram(publishedCount: number) {
      const { id } = await prisma.trainingProgram.create({
        data: {
          trainerId: owner.id,
          status: publishedCount > 0 ? 'PUBLISHED' : 'DRAFT',
          versions: {
            create: [
              ...Array.from({ length: publishedCount }, (_, index) => ({
                version: index + 1,
                title: `Published version ${index + 1}`,
                status: 'PUBLISHED' as const,
                publishedAt: new Date(),
              })),
              { version: publishedCount + 1, title: 'Private draft', status: 'DRAFT' },
            ],
          },
        },
      });
      programIds.push(id);
      return id;
    }

    emptyProgramId = await createProgram(0);
    oneVersionProgramId = await createProgram(1);
    largeProgramId = await createProgram(41);
  }, 30_000);

  afterAll(async () => {
    try {
      if (programIds.length) {
        await prisma.trainingProgramVersion.deleteMany({
          where: { programId: { in: programIds } },
        });
        await prisma.trainingProgram.deleteMany({ where: { id: { in: programIds } } });
      }
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('returns empty and one-version terminal pages and excludes the current draft', async () => {
    const http = request(app!.getHttpServer());
    const empty = await http
      .get(publishedPath(emptyProgramId))
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(empty.body).toEqual({ data: [], nextBeforeVersion: null });

    const single = await http
      .get(publishedPath(oneVersionProgramId))
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(single.body).toEqual({
      data: [expect.objectContaining({ version: 1, status: 'PUBLISHED' })],
      nextBeforeVersion: null,
    });
    expect(single.body.data[0]).not.toHaveProperty('workouts');
  });

  it('paginates 41 publications without duplicates and ends a page with exactly 40', async () => {
    const ownerGet = () =>
      request(app!.getHttpServer()).get(publishedPath(largeProgramId)).set('Cookie', ownerCookie);
    const versions = (rows: Array<{ version: number }>) => rows.map(({ version }) => version);

    const defaultPage = await ownerGet().expect(200);
    expect(defaultPage.body.data).toHaveLength(20);
    expect(defaultPage.body.nextBeforeVersion).toBe(22);

    const first = await ownerGet().query({ limit: 40 }).expect(200);
    expect(versions(first.body.data)).toEqual(Array.from({ length: 40 }, (_, index) => 41 - index));
    expect(first.body.nextBeforeVersion).toBe(2);

    const second = await ownerGet().query({ limit: 40, beforeVersion: 2 }).expect(200);
    expect(versions(second.body.data)).toEqual([1]);
    expect(second.body.nextBeforeVersion).toBeNull();

    const exactPage = await ownerGet().query({ limit: 40, beforeVersion: 41 }).expect(200);
    expect(versions(exactPage.body.data)).toEqual(
      Array.from({ length: 40 }, (_, index) => 40 - index),
    );
    expect(exactPage.body.nextBeforeVersion).toBeNull();
  });

  it('preserves the legacy array with both published versions and the draft', async () => {
    const legacy = await request(app!.getHttpServer())
      .get(`/training-programs/${largeProgramId}/versions`)
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(legacy.body).toHaveLength(42);
    expect(legacy.body[0]).toMatchObject({ version: 42, status: 'DRAFT' });
    expect(legacy.body[41]).toMatchObject({ version: 1, status: 'PUBLISHED' });
  });

  it('enforces trainer access and rejects invalid pagination input', async () => {
    const http = request(app!.getHttpServer());
    const path = publishedPath(largeProgramId);
    await http.get(path).expect(401);
    await http.get(path).set('Cookie', athleteCookie).expect(403);
    await http.get(path).set('Cookie', otherTrainerCookie).expect(404);
    await http.get(publishedPath(randomUUID())).set('Cookie', ownerCookie).expect(404);

    for (const query of [
      { limit: 0 },
      { limit: 41 },
      { beforeVersion: 1.5 },
      { beforeVersion: 2_147_483_648 },
    ]) {
      await http.get(path).set('Cookie', ownerCookie).query(query).expect(400);
    }
  });
});
