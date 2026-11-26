-- Additive only: no backfill or implicit external notification consent.
CREATE TYPE "NotificationCategory" AS ENUM ('TRAINER', 'PROGRAM', 'WORKOUT', 'ACCOUNT');
CREATE TYPE "NotificationChannel" AS ENUM ('MOBILE_PUSH', 'LOCAL_REMINDER', 'EMAIL');

CREATE TABLE "notification_settings" (
  "user_id" TEXT NOT NULL,
  "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "quiet_start_minute" INTEGER NOT NULL DEFAULT 1320,
  "quiet_end_minute" INTEGER NOT NULL DEFAULT 480,
  "reminder_lead_minutes" INTEGER NOT NULL DEFAULT 60,
  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_settings_quiet_minutes_check"
    CHECK ("quiet_start_minute" BETWEEN 0 AND 1439 AND "quiet_end_minute" BETWEEN 0 AND 1439
      AND "quiet_start_minute" <> "quiet_end_minute"),
  CONSTRAINT "notification_settings_reminder_lead_check"
    CHECK ("reminder_lead_minutes" IN (15, 60, 1440)),
  CONSTRAINT "notification_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notification_preferences" (
  "user_id" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "consented_at" TIMESTAMPTZ(3),
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id", "category", "channel"),
  CONSTRAINT "notification_preferences_consent_check"
    CHECK ("enabled" = ("consented_at" IS NOT NULL)),
  CONSTRAINT "notification_preferences_channel_check"
    CHECK (
      ("category" IN ('TRAINER', 'PROGRAM') AND "channel" = 'MOBILE_PUSH')
      OR ("category" = 'WORKOUT' AND "channel" = 'LOCAL_REMINDER')
      OR ("category" = 'ACCOUNT' AND "channel" = 'EMAIL')
    ),
  CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
