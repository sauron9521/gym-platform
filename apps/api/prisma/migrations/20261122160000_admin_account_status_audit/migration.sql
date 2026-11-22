-- #293: durable audit of real status changes, written in the SAME transaction
-- as the account update and credential revocation. Never use this as a queue.
CREATE TYPE "AdminAccountStatusAuditAction" AS ENUM ('SUSPEND', 'REACTIVATE');
CREATE TYPE "AdminAccountStatusReason" AS ENUM ('SECURITY', 'POLICY', 'USER_REQUEST', 'ERROR_CORRECTION');

CREATE TABLE "admin_account_status_audit" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "action" "AdminAccountStatusAuditAction" NOT NULL,
  "from_status" "AccountStatus" NOT NULL,
  "to_status" "AccountStatus" NOT NULL,
  "reason_code" "AdminAccountStatusReason" NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_account_status_audit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_account_status_audit_direction_check" CHECK (
    ("action" = 'SUSPEND' AND "from_status" = 'ACTIVE' AND "to_status" = 'SUSPENDED') OR
    ("action" = 'REACTIVATE' AND "from_status" = 'SUSPENDED' AND "to_status" = 'ACTIVE')
  )
);
CREATE INDEX "admin_account_status_audit_target_id_occurred_at_idx"
  ON "admin_account_status_audit" ("target_id", "occurred_at" DESC);
CREATE INDEX "admin_account_status_audit_actor_id_occurred_at_idx"
  ON "admin_account_status_audit" ("actor_id", "occurred_at" DESC);

-- A row-level trigger prevents accidental ORM/raw SQL updates or deletes.
-- A privileged DB owner can still DROP the trigger or TRUNCATE the table:
-- production-grade tamper resistance also needs distinct DB roles/backups.
CREATE FUNCTION "reject_admin_account_status_audit_mutation"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin account status audit is append-only' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "admin_account_status_audit_immutable"
  BEFORE UPDATE OR DELETE ON "admin_account_status_audit"
  FOR EACH ROW EXECUTE FUNCTION "reject_admin_account_status_audit_mutation"();
