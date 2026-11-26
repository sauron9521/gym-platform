import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../utility/test-db-helper.js';
import { defaultNotificationSettings } from '../../../src/modules/notifications/domain/notification-settings.policy.js';

describe('notification preference persistence (real PostgreSQL)', () => {
  let prisma: PrismaClient;
  const owner = randomUUID();
  const other = randomUUID();
  const pair = { category: 'TRAINER', channel: 'MOBILE_PUSH' } as const;
  const key = { userId_category_channel: { userId: owner, ...pair } };

  beforeAll(async () => {
    useTestDatabase();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
    });
  });

  beforeEach(async () => {
    await prisma.user.createMany({
      data: [owner, other].map((id) => ({
        id,
        email: `notification-settings-${id}@example.test`,
        passwordHash: 'test-only',
      })),
    });
  });

  afterEach(async () => {
    await prisma?.user.deleteMany({ where: { id: { in: [owner, other] } } });
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('creates no implicit consent and persists the same quiet defaults as policy', async () => {
    expect(await prisma.notificationSettings.findUnique({ where: { userId: owner } })).toBeNull();
    expect(await prisma.notificationPreference.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.notificationSettings.create({ data: { userId: owner } })).toEqual({
      userId: owner,
      ...defaultNotificationSettings,
    });
    expect(
      await prisma.notificationPreference.create({ data: { userId: owner, ...pair } }),
    ).toEqual({
      userId: owner,
      ...pair,
      enabled: false,
      consentedAt: null,
    });
    expect(await prisma.notificationSettings.findUnique({ where: { userId: other } })).toBeNull();
  });

  it('requires explicit consent timestamp, permits revocation and keeps another account isolated', async () => {
    await prisma.notificationPreference.create({ data: { userId: owner, ...pair } });
    await expect(
      prisma.notificationPreference.update({ where: key, data: { enabled: true } }),
    ).rejects.toThrow();
    const timestamp = new Date('2026-11-26T10:00:00.000Z');
    await prisma.notificationPreference.update({
      where: key,
      data: { enabled: true, consentedAt: timestamp },
    });
    await prisma.notificationPreference.create({
      data: { userId: other, ...pair, enabled: true, consentedAt: timestamp },
    });
    await prisma.notificationPreference.update({
      where: key,
      data: { enabled: false, consentedAt: null },
    });
    expect(await prisma.notificationPreference.findUnique({ where: key })).toMatchObject({
      enabled: false,
      consentedAt: null,
    });
    expect(
      await prisma.notificationPreference.findUnique({
        where: { userId_category_channel: { userId: other, ...pair } },
      }),
    ).toMatchObject({ enabled: true, consentedAt: timestamp });
  });

  it('rejects out-of-range/equal quiet hours, unsupported lead, duplicates and unsupported channel pairs', async () => {
    await prisma.notificationSettings.create({ data: { userId: owner } });
    await prisma.notificationPreference.create({ data: { userId: owner, ...pair } });
    for (const data of [
      { quietStartMinute: -1 },
      { quietEndMinute: 1440 },
      { quietStartMinute: 480 },
      { reminderLeadMinutes: 30 },
    ]) {
      await expect(
        prisma.notificationSettings.update({ where: { userId: owner }, data }),
      ).rejects.toThrow();
    }
    await expect(
      prisma.notificationPreference.create({ data: { userId: owner, ...pair } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.notificationPreference.create({
        data: { userId: owner, category: 'WORKOUT', channel: 'EMAIL' },
      }),
    ).rejects.toThrow();
    expect(await prisma.notificationSettings.findUnique({ where: { userId: owner } })).toEqual({
      userId: owner,
      ...defaultNotificationSettings,
    });
  });

  it('rolls back related changes together and cascades on hard user deletion', async () => {
    await prisma.notificationSettings.create({ data: { userId: owner } });
    await prisma.notificationPreference.createMany({
      data: [owner, other].map((userId) => ({ userId, ...pair })),
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.notificationSettings.update({
          where: { userId: owner },
          data: { quietHoursEnabled: false },
        });
        await tx.notificationPreference.update({ where: key, data: { enabled: true } });
      }),
    ).rejects.toThrow();
    expect(
      await prisma.notificationSettings.findUnique({ where: { userId: owner } }),
    ).toMatchObject({ quietHoursEnabled: true });
    await prisma.user.delete({ where: { id: owner } });
    expect(await prisma.notificationSettings.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.notificationPreference.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.notificationPreference.count({ where: { userId: other } })).toBe(1);
  });
});
