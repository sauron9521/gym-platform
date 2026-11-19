-- M05 / E6 / #309: additive TrainerProfile and application moderation history.
-- This migration does NOT grant TRAINER role/capability to any user.
-- No backfill is needed: existing ATHLETE/TRAINER accounts remain unchanged.

CREATE TYPE "TrainerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

CREATE TABLE "trainer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bio" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMPTZ(3),
    "approved_by_id" TEXT,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trainer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trainer_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "TrainerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "applicant_note" VARCHAR(1000),
    "reviewer_id" TEXT,
    "review_reason" VARCHAR(500),
    "reviewed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trainer_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_profiles_user_id_key" ON "trainer_profiles"("user_id");

CREATE INDEX "trainer_profiles_approved_by_id_idx" ON "trainer_profiles"("approved_by_id");
CREATE INDEX "trainer_profiles_revoked_by_id_idx" ON "trainer_profiles"("revoked_by_id");

CREATE UNIQUE INDEX "trainer_applications_one_pending_per_user_key"
    ON "trainer_applications"("user_id") WHERE ("status" = 'PENDING');

CREATE INDEX "trainer_applications_user_id_created_at_idx"
    ON "trainer_applications"("user_id", "created_at" DESC);

CREATE INDEX "trainer_applications_status_created_at_idx"
    ON "trainer_applications"("status", "created_at" DESC);

CREATE INDEX "trainer_applications_reviewer_id_idx" ON "trainer_applications"("reviewer_id");

ALTER TABLE "trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainer_applications"
    ADD CONSTRAINT "trainer_applications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainer_applications"
    ADD CONSTRAINT "trainer_applications_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hard invariant: activating a TrainerProfile requires a recorded approving actor,
-- and a revoked profile can never remain active. Server policy adds #291/#311 checks.
ALTER TABLE "trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_active_approval_check"
    CHECK (NOT "is_active" OR (
      "approved_at" IS NOT NULL AND "approved_by_id" IS NOT NULL AND "revoked_at" IS NULL
    ));

-- A PENDING application is undecided. Every terminal decision must retain
-- reviewer/time for audit; a revoked application must retain revocation time.
ALTER TABLE "trainer_applications"
    ADD CONSTRAINT "trainer_applications_decision_audit_check"
    CHECK (
      ("status" = 'PENDING' AND "reviewer_id" IS NULL AND "reviewed_at" IS NULL AND "revoked_at" IS NULL)
      OR
      ("status" IN ('APPROVED', 'REJECTED') AND "reviewer_id" IS NOT NULL
        AND "reviewed_at" IS NOT NULL AND "revoked_at" IS NULL)
      OR
      ("status" = 'REVOKED' AND "reviewer_id" IS NOT NULL
        AND "reviewed_at" IS NOT NULL AND "revoked_at" IS NOT NULL)
    );
