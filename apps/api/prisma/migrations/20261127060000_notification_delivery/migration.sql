CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('EMAIL', 'MOBILE_PUSH');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'CLAIMED', 'SENDING', 'SENT', 'CANCELLED', 'DEAD_LETTER', 'UNKNOWN');
CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "destination_key" VARCHAR(100) NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "consented_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claim_token" TEXT,
  "lease_until" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ(3),
  "finished_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(100),
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_attempts_check" CHECK ("attempt_count" BETWEEN 0 AND 5),
  CONSTRAINT "notification_deliveries_lease_check" CHECK (
    ("status" IN ('CLAIMED','SENDING') AND "claim_token" IS NOT NULL AND "lease_until" IS NOT NULL)
    OR ("status" NOT IN ('CLAIMED','SENDING') AND "claim_token" IS NULL AND "lease_until" IS NULL)
  ),
  CONSTRAINT "notification_deliveries_finished_check" CHECK (
    ("status" IN ('SENT','CANCELLED','DEAD_LETTER','UNKNOWN') AND "finished_at" IS NOT NULL)
    OR ("status" NOT IN ('SENT','CANCELLED','DEAD_LETTER','UNKNOWN') AND "finished_at" IS NULL)
  ),
  CONSTRAINT "notification_deliveries_destination_check" CHECK (
    ("channel" = 'EMAIL' AND "destination_key" = 'account-email')
    OR ("channel" = 'MOBILE_PUSH' AND "destination_key" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);
CREATE UNIQUE INDEX "notification_deliveries_destination_key" ON "notification_deliveries"("notification_id", "channel", "destination_key");
CREATE INDEX "notification_deliveries_available_idx" ON "notification_deliveries"("status", "available_at");
CREATE INDEX "notification_deliveries_lease_idx" ON "notification_deliveries"("status", "lease_until");
CREATE INDEX "notification_deliveries_expiry_idx" ON "notification_deliveries"("status", "expires_at");
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
