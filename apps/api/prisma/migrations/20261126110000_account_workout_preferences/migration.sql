-- Nullable fields distinguish uninitialized accounts from explicit choices.
ALTER TABLE "users"
  ADD COLUMN "auto_rest_timer" BOOLEAN,
  ADD COLUMN "rest_duration_seconds" INTEGER,
  ADD CONSTRAINT "users_rest_duration_seconds_check"
    CHECK ("rest_duration_seconds" IN (60, 90, 120));
