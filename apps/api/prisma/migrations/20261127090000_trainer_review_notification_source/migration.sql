ALTER TABLE "notifications" ADD COLUMN "trainer_application_id" TEXT;
CREATE INDEX "notifications_trainer_application_id_idx" ON "notifications"("trainer_application_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trainer_application_id_fkey"
  FOREIGN KEY ("trainer_application_id") REFERENCES "trainer_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
