ALTER TABLE "mfa_authenticators"
  ADD COLUMN "enrollment_session_id" VARCHAR(64),
  ADD COLUMN "enrollment_expires_at" TIMESTAMPTZ(3);
