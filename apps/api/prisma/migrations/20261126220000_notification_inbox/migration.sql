CREATE TYPE "NotificationScope" AS ENUM ('USER', 'ADMIN');

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "scope" "NotificationScope" NOT NULL,
  "type" VARCHAR(100) NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "template_key" VARCHAR(100) NOT NULL,
  "resource_type" VARCHAR(100),
  "resource_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_event_id_recipient_id_scope_key" ON "notifications"("event_id", "recipient_id", "scope");
CREATE INDEX "notifications_recipient_scope_cursor_idx" ON "notifications"("recipient_id", "scope", "created_at" DESC, "id" DESC);
CREATE INDEX "notifications_recipient_scope_read_idx" ON "notifications"("recipient_id", "scope", "read_at");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
