-- Additive authentication gate: all existing accounts remain ACTIVE.
-- Suspension commands and atomic token/session revocation are NOT enabled here.
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "users"
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
