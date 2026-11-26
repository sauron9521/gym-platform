import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '#src/infra/database/index';
import { NotificationSettingsRepository } from '../repositories/notification-settings.repository.js';
import {
  defaultNotificationSettings,
  defaultNotificationPreferences,
} from '../domain/notification-settings.policy.js';

const id = 'actor-1';
const pair = { category: 'TRAINER', channel: 'MOBILE_PUSH' } as const;
const defaults = {
  profile: null,
  notificationSettings: null,
  notificationPreferences: [],
};
const expected = {
  ...defaultNotificationSettings,
  timezone: 'UTC',
  preferences: defaultNotificationPreferences.map((p) => ({ ...p, consentedAt: null })),
};

describe('NotificationSettingsRepository', () => {
  const tx = {
    user: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    notificationSettings: { upsert: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  const repository = new NotificationSettingsRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (work) => work(tx));
    tx.user.findUnique.mockResolvedValue(defaults);
    tx.$queryRaw.mockResolvedValue([{ id }]);
  });

  it('reads a coherent private projection without creating rows', async () => {
    await expect(repository.get(id)).resolves.toEqual(expected);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(tx.user.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id, status: 'ACTIVE', deletedAt: null },
      select: {
        profile: { select: { timezone: true } },
        notificationSettings: {
          select: {
            quietHoursEnabled: true,
            quietStartMinute: true,
            quietEndMinute: true,
            reminderLeadMinutes: true,
          },
        },
        notificationPreferences: {
          select: { category: true, channel: true, enabled: true, consentedAt: true },
        },
      },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.notificationSettings.upsert).not.toHaveBeenCalled();
    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('does not project a consent without its timestamp or an invalid timezone as valid', async () => {
    tx.user.findUnique.mockResolvedValue({
      ...defaults,
      profile: { timezone: 'invalid' },
      notificationPreferences: [{ ...pair, enabled: true, consentedAt: null }],
    });
    await expect(repository.get(id)).resolves.toEqual({ ...expected, timezone: null });
  });

  it('rejects invalid input before entering a transaction and missing accounts before writing', async () => {
    await expect(repository.patch(id, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(repository.patch(id, { quietHoursEnabled: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.notificationSettings.upsert).not.toHaveBeenCalled();
    tx.user.findUnique.mockResolvedValue(null);
    await expect(repository.get(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('locks the active owner and uses only explicit settings fields on update', async () => {
    await repository.patch(id, { quietHoursEnabled: false });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
    const [sql, owner] = tx.$queryRaw.mock.calls[0]!;
    expect(owner).toBe(id);
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(sql.join('?')).toContain('"deleted_at" IS NULL');
    expect(tx.notificationSettings.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { userId: id },
      create: { userId: id, ...defaultNotificationSettings, quietHoursEnabled: false },
      update: { quietHoursEnabled: false },
    });
    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid merged quiet window before any consent or settings write', async () => {
    await expect(
      repository.patch(id, { quietStartMinute: 480, preferences: [{ ...pair, enabled: true }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.notificationSettings.upsert).not.toHaveBeenCalled();
    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('does not write defaults or repeated consent, but records an explicit enable and revocation', async () => {
    await repository.patch(id, { preferences: [{ ...pair, enabled: false }] });
    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
    await repository.patch(id, { preferences: [{ ...pair, enabled: true }] });
    expect(tx.notificationPreference.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { userId_category_channel: { userId: id, ...pair } },
      create: { userId: id, ...pair, enabled: true, consentedAt: expect.any(Date) },
      update: { enabled: true, consentedAt: expect.any(Date) },
    });
    tx.notificationPreference.upsert.mockClear();
    tx.user.findUnique.mockResolvedValue({
      ...defaults,
      notificationPreferences: [{ ...pair, enabled: true, consentedAt: new Date() }],
    });
    await repository.patch(id, { preferences: [{ ...pair, enabled: true }] });
    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
    await repository.patch(id, { preferences: [{ ...pair, enabled: false }] });
    expect(tx.notificationPreference.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { userId_category_channel: { userId: id, ...pair } },
      create: { userId: id, ...pair, enabled: false, consentedAt: null },
      update: { enabled: false, consentedAt: null },
    });
    expect(tx.notificationSettings.upsert).not.toHaveBeenCalled();
  });

  it('propagates database failures without reporting a successful save', async () => {
    const error = new Error('unavailable');
    tx.notificationSettings.upsert.mockRejectedValue(error);
    await expect(repository.patch(id, { quietHoursEnabled: false })).rejects.toBe(error);
  });
});
