-- Advance a persisted JWT invalidation fence on each account status transition.
-- Existing accounts retain NULL, preserving valid pre-migration JWTs.
ALTER TABLE "users" ADD COLUMN "auth_invalidated_at" TIMESTAMPTZ(3);
