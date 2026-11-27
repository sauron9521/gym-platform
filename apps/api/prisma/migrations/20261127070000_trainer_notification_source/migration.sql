ALTER TABLE "notifications" ADD COLUMN "trainer_relationship_id" TEXT;
CREATE INDEX "notifications_trainer_relationship_id_idx" ON "notifications"("trainer_relationship_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trainer_relationship_id_fkey"
  FOREIGN KEY ("trainer_relationship_id") REFERENCES "trainer_athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
