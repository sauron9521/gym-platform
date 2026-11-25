CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD_LETTER');

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "event_key" VARCHAR(200) NOT NULL,
  "type" VARCHAR(100) NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "actor_user_id" TEXT,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ(3),
  "processed_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(100),
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_event_key_key" ON "outbox_events"("event_key");
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");
CREATE INDEX "outbox_events_status_lease_until_idx" ON "outbox_events"("status", "lease_until");
CREATE INDEX "outbox_events_actor_user_id_idx" ON "outbox_events"("actor_user_id");
