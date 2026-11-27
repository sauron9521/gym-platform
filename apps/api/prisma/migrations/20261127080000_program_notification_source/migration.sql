ALTER TABLE "notifications" ADD COLUMN "program_assignment_id" TEXT;
CREATE INDEX "notifications_program_assignment_id_idx" ON "notifications"("program_assignment_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_program_assignment_id_fkey"
  FOREIGN KEY ("program_assignment_id") REFERENCES "training_program_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
