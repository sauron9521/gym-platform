import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import {
  defaultNotificationSettings,
  defaultNotificationPreferences,
  isNotificationTimezone,
  notificationSettingsSchema,
  mergeNotificationSettings,
  notificationSettingsPatchSchema,
  type NotificationSettingsPatch,
} from '../domain/notification-settings.policy.js';

const active = (id: string) => ({ id, deletedAt: null, status: 'ACTIVE' as const });
const preferenceSelect = {
  category: true,
  channel: true,
  enabled: true,
  consentedAt: true,
} as const;
const settingsSelect = {
  quietHoursEnabled: true,
  quietStartMinute: true,
  quietEndMinute: true,
  reminderLeadMinutes: true,
} as const;
const select = {
  profile: { select: { timezone: true } },
  notificationSettings: { select: settingsSelect },
  notificationPreferences: { select: preferenceSelect },
} as const;

type Stored = Prisma.UserGetPayload<{ select: typeof select }>;

function project(row: Stored) {
  const timezone = row.profile?.timezone ?? 'UTC';
  return {
    ...notificationSettingsSchema.parse(row.notificationSettings ?? defaultNotificationSettings),
    // Do not silently convert corrupt legacy timezone data into another zone.
    timezone: isNotificationTimezone(timezone) ? timezone : null,
    preferences: defaultNotificationPreferences.map((pair) => {
      const stored = row.notificationPreferences.find(
        (p) => p.category === pair.category && p.channel === pair.channel,
      );
      const enabled = stored?.enabled === true && stored.consentedAt !== null;
      return { ...pair, enabled, consentedAt: enabled ? stored.consentedAt : null };
    }),
  };
}

@Injectable()
export class NotificationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async read(tx: Prisma.TransactionClient, id: string) {
    const row = await tx.user.findUnique({ where: active(id), select });
    if (!row) throw new NotFoundException('Account not found');
    return row;
  }

  async get(id: string) {
    // Prisma relation reads may use multiple SQL statements. A repeatable-read
    // snapshot keeps settings and consent consistent without taking write locks.
    return this.prisma.$transaction(async (tx) => project(await this.read(tx, id)), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  async patch(id: string, input: NotificationSettingsPatch) {
    const validated = notificationSettingsPatchSchema.safeParse(input);
    if (!validated.success) throw new BadRequestException('Invalid notification settings');
    const { preferences, ...fields } = validated.data;
    return this.prisma.$transaction(
      async (tx) => {
        // Serialize all settings writers, including a first PATCH with no rows.
        // The same user-row lock also fences concurrent account suspension/deletion.
        const owners = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "users"
        WHERE "id" = ${id} AND "deleted_at" IS NULL AND "status" = 'ACTIVE'
        FOR UPDATE
      `;
        if (!owners.length) throw new NotFoundException('Account not found');
        const row = await this.read(tx, id);
        const current = notificationSettingsSchema.parse(
          row.notificationSettings ?? defaultNotificationSettings,
        );
        let merged;
        try {
          merged = mergeNotificationSettings(current, validated.data);
        } catch {
          throw new BadRequestException('Quiet hours must have distinct endpoints');
        }
        if (Object.keys(fields).length) {
          await tx.notificationSettings.upsert({
            where: { userId: id },
            create: { userId: id, ...merged },
            update: fields,
          });
        }
        for (const preference of preferences ?? []) {
          const { category, channel, enabled } = preference;
          const previous = row.notificationPreferences.find(
            (p) => p.category === category && p.channel === channel,
          );
          // Idempotent repeated enable preserves the original consent timestamp.
          // Disable on a missing row is a no-op; default is already off.
          if ((previous?.enabled ?? false) === enabled) continue;
          const data = { enabled, consentedAt: enabled ? new Date() : null };
          await tx.notificationPreference.upsert({
            where: { userId_category_channel: { userId: id, category, channel } },
            create: { userId: id, category, channel, ...data },
            update: data,
          });
        }
        return project(await this.read(tx, id));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
