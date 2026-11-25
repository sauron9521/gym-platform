CREATE TABLE "mfa_authenticators" (
  "user_id" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "confirmed" BOOLEAN NOT NULL DEFAULT false,
  "pending_secret" TEXT,
  "last_used_step" INTEGER,
  CONSTRAINT "mfa_authenticators_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "mfa_recovery_codes" (
  "user_id" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("user_id", "hash")
);

CREATE TABLE "mfa_failures" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "mfa_failures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_failures_user_id_occurred_at_idx"
  ON "mfa_failures"("user_id", "occurred_at");

ALTER TABLE "mfa_authenticators"
  ADD CONSTRAINT "mfa_authenticators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_recovery_codes"
  ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_failures"
  ADD CONSTRAINT "mfa_failures_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
