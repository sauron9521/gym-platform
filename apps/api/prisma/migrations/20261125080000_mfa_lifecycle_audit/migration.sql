CREATE TYPE "MfaLifecycleAction" AS ENUM ('FIRST_TOTP_CONFIRMED');

CREATE TABLE "mfa_lifecycle_audit" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" "MfaLifecycleAction" NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_lifecycle_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_lifecycle_audit_user_id_occurred_at_idx"
  ON "mfa_lifecycle_audit"("user_id", "occurred_at" DESC);
