-- Additive markers preserve the unique event key and prevent re-delivery.
ALTER TABLE "outbox_events"
  ADD COLUMN "inbox_retired_at" TIMESTAMPTZ(3),
  ADD COLUMN "email_retired_at" TIMESTAMPTZ(3);
CREATE INDEX "outbox_events_retention_idx" ON "outbox_events"("status", "processed_at");
CREATE INDEX "notifications_retention_idx" ON "notifications"("scope", "category", "created_at");
CREATE INDEX "notification_deliveries_retention_idx"
  ON "notification_deliveries"("channel", "status", "finished_at");
