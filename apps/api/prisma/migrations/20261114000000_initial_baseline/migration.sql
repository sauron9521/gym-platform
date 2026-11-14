-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('GLOBAL', 'ATHLETE_CUSTOM', 'TRAINER_CUSTOM');

-- CreateEnum
CREATE TYPE "ExerciseVisibility" AS ENUM ('PRIVATE', 'SELECTED_TRAINERS');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('STRENGTH', 'CARDIO', 'MOBILITY', 'PLYOMETRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "TrainerAthleteStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'CANCELLED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "TrainingProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingProgramVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TrainingProgramAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ATHLETE', 'TRAINER', 'ADMIN');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkoutSetStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkoutSetType" AS ENUM ('WARMUP', 'WORKING', 'DROP_SET', 'AMRAP');

-- CreateTable
CREATE TABLE "refresh_token_families" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "refresh_token_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" VARCHAR(64) NOT NULL,
    "family_id" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "family_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "claims" JSONB,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tokens" (
    "id" VARCHAR(64) NOT NULL,
    "purpose" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fingerprint" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_measurements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "body_fat_pct" DECIMAL(5,2),
    "chest_cm" DECIMAL(5,2),
    "waist_cm" DECIMAL(5,2),
    "hips_cm" DECIMAL(5,2),
    "arm_cm" DECIMAL(5,2),
    "thigh_cm" DECIMAL(5,2),
    "notes" VARCHAR(500),
    "measured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140),
    "description" TEXT,
    "instructions" TEXT,
    "source" "ExerciseSource" NOT NULL,
    "visibility" "ExerciseVisibility",
    "exerciseType" "ExerciseType" NOT NULL DEFAULT 'STRENGTH',
    "created_by_id" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "copied_from_exercise_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscle_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,

    CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_muscle_groups" (
    "exercise_id" TEXT NOT NULL,
    "muscle_group_id" TEXT NOT NULL,
    "role" "MuscleRole" NOT NULL DEFAULT 'SECONDARY',

    CONSTRAINT "exercise_muscle_groups_pkey" PRIMARY KEY ("exercise_id","muscle_group_id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_equipments" (
    "exercise_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,

    CONSTRAINT "exercise_equipments_pkey" PRIMARY KEY ("exercise_id","equipment_id")
);

-- CreateTable
CREATE TABLE "exercise_trainer_access" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "exercise_trainer_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_athlete_assignments" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "exercise_athlete_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "display_name" TEXT,
    "avatar_url" VARCHAR(2048),
    "avatar_key" VARCHAR(48),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "birthday" DATE,
    "height" INTEGER,
    "weight" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_active_at" TIMESTAMPTZ(3) NOT NULL,
    "mfa" TEXT,
    "metadata" JSONB,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_athletes" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "initiated_by_id" TEXT NOT NULL,
    "status" "TrainerAthleteStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "ended_by_id" TEXT,
    "end_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trainer_athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "status" "TrainingProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_program_versions" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "duration_weeks" INTEGER,
    "status" "TrainingProgramVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_program_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_program_workouts" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "day_number" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_program_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_program_exercises" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "exercise_name_snapshot" VARCHAR(120) NOT NULL,
    "exercise_type_snapshot" "ExerciseType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_program_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_program_sets" (
    "id" TEXT NOT NULL,
    "program_exercise_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "set_type" "WorkoutSetType" NOT NULL DEFAULT 'WORKING',
    "planned_reps" INTEGER,
    "planned_weight_kg" DECIMAL(8,2),
    "planned_duration_seconds" INTEGER,
    "planned_distance_meters" DECIMAL(10,2),
    "rest_seconds" INTEGER,
    "target_rpe" DECIMAL(3,1),
    "target_rir" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_program_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_program_assignments" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "trainer_athlete_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "status" "TrainingProgramAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "ended_by_id" TEXT,
    "end_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_program_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATHLETE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "athlete_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduled_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "program_assignment_id" TEXT,
    "program_workout_id" TEXT,
    "idempotency_key" VARCHAR(128),
    "idempotency_fingerprint" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "exercise_name_snapshot" VARCHAR(120) NOT NULL,
    "exercise_type_snapshot" "ExerciseType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" TEXT NOT NULL,
    "workout_exercise_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "set_type" "WorkoutSetType" NOT NULL DEFAULT 'WORKING',
    "status" "WorkoutSetStatus" NOT NULL DEFAULT 'PENDING',
    "planned_reps" INTEGER,
    "planned_weight_kg" DECIMAL(8,2),
    "planned_duration_seconds" INTEGER,
    "planned_distance_meters" DECIMAL(10,2),
    "actual_reps" INTEGER,
    "actual_weight_kg" DECIMAL(8,2),
    "actual_duration_seconds" INTEGER,
    "actual_distance_meters" DECIMAL(10,2),
    "rest_seconds" INTEGER,
    "target_rpe" DECIMAL(3,1),
    "target_rir" INTEGER,
    "rpe" DECIMAL(3,1),
    "rir" INTEGER,
    "completed_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refresh_token_families_user_id_idx" ON "refresh_token_families"("user_id");

-- CreateIndex
CREATE INDEX "refresh_token_families_family_expires_at_idx" ON "refresh_token_families"("family_expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_expires_at_idx" ON "refresh_tokens"("family_expires_at");

-- CreateIndex
CREATE INDEX "email_tokens_user_id_purpose_idx" ON "email_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "email_tokens_expires_at_idx" ON "email_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "body_measurements_user_id_measured_at_id_idx" ON "body_measurements"("user_id", "measured_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_slug_key" ON "exercises"("slug");

-- CreateIndex
CREATE INDEX "exercises_source_is_archived_idx" ON "exercises"("source", "is_archived");

-- CreateIndex
CREATE INDEX "exercises_created_by_id_idx" ON "exercises"("created_by_id");

-- CreateIndex
CREATE INDEX "exercises_name_idx" ON "exercises"("name");

-- CreateIndex
CREATE INDEX "exercises_copied_from_exercise_id_idx" ON "exercises"("copied_from_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "muscle_groups_name_key" ON "muscle_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "muscle_groups_slug_key" ON "muscle_groups"("slug");

-- CreateIndex
CREATE INDEX "exercise_muscle_groups_muscle_group_id_exercise_id_idx" ON "exercise_muscle_groups"("muscle_group_id", "exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_slug_key" ON "equipment"("slug");

-- CreateIndex
CREATE INDEX "exercise_equipments_equipment_id_exercise_id_idx" ON "exercise_equipments"("equipment_id", "exercise_id");

-- CreateIndex
CREATE INDEX "exercise_trainer_access_trainer_id_revoked_at_idx" ON "exercise_trainer_access"("trainer_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_trainer_access_exercise_id_trainer_id_key" ON "exercise_trainer_access"("exercise_id", "trainer_id");

-- CreateIndex
CREATE INDEX "exercise_athlete_assignments_athlete_id_revoked_at_idx" ON "exercise_athlete_assignments"("athlete_id", "revoked_at");

-- CreateIndex
CREATE INDEX "exercise_athlete_assignments_assigned_by_id_idx" ON "exercise_athlete_assignments"("assigned_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_athlete_assignments_exercise_id_athlete_id_key" ON "exercise_athlete_assignments"("exercise_id", "athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_avatar_key_key" ON "profiles"("avatar_key");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_created_at_idx" ON "sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "trainer_athletes_trainer_id_status_created_at_idx" ON "trainer_athletes"("trainer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "trainer_athletes_athlete_id_status_created_at_idx" ON "trainer_athletes"("athlete_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "trainer_athletes_initiated_by_id_created_at_idx" ON "trainer_athletes"("initiated_by_id", "created_at");

-- CreateIndex
CREATE INDEX "trainer_athletes_ended_by_id_idx" ON "trainer_athletes"("ended_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_athletes_open_pair_key" ON "trainer_athletes"("trainer_id", "athlete_id") WHERE (status IN ('PENDING', 'ACTIVE'));

-- CreateIndex
CREATE INDEX "training_programs_trainer_id_status_updated_at_idx" ON "training_programs"("trainer_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "training_program_versions_program_id_status_version_idx" ON "training_program_versions"("program_id", "status", "version");

-- CreateIndex
CREATE UNIQUE INDEX "training_program_versions_program_id_version_key" ON "training_program_versions"("program_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "training_program_versions_one_draft_key" ON "training_program_versions"("program_id") WHERE (status = 'DRAFT');

-- CreateIndex
CREATE UNIQUE INDEX "training_program_workouts_version_id_week_number_day_number_key" ON "training_program_workouts"("version_id", "week_number", "day_number");

-- CreateIndex
CREATE INDEX "training_program_exercises_exercise_id_idx" ON "training_program_exercises"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_program_exercises_workout_id_sort_order_key" ON "training_program_exercises"("workout_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "training_program_sets_program_exercise_id_set_number_key" ON "training_program_sets"("program_exercise_id", "set_number");

-- CreateIndex
CREATE INDEX "training_program_assignments_trainer_athlete_id_status_idx" ON "training_program_assignments"("trainer_athlete_id", "status");

-- CreateIndex
CREATE INDEX "training_program_assignments_athlete_id_status_assigned_at_idx" ON "training_program_assignments"("athlete_id", "status", "assigned_at");

-- CreateIndex
CREATE INDEX "training_program_assignments_athlete_id_assigned_at_id_idx" ON "training_program_assignments"("athlete_id", "assigned_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "training_program_assignments_version_id_idx" ON "training_program_assignments"("version_id");

-- CreateIndex
CREATE INDEX "training_program_assignments_assigned_by_id_idx" ON "training_program_assignments"("assigned_by_id");

-- CreateIndex
CREATE INDEX "training_program_assignments_ended_by_id_idx" ON "training_program_assignments"("ended_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_program_assignments_one_active_version_key" ON "training_program_assignments"("version_id", "athlete_id") WHERE (status = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "workouts_program_assignment_id_idx" ON "workouts"("program_assignment_id");

-- CreateIndex
CREATE INDEX "workouts_program_workout_id_idx" ON "workouts"("program_workout_id");

-- CreateIndex
CREATE INDEX "workouts_athlete_id_scheduled_at_idx" ON "workouts"("athlete_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "workouts_athlete_id_status_scheduled_at_idx" ON "workouts"("athlete_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "workouts_athlete_id_status_completed_at_idx" ON "workouts"("athlete_id", "status", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "workouts_created_by_id_created_at_idx" ON "workouts"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "workouts_athlete_id_created_at_id_idx" ON "workouts"("athlete_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "workouts_athlete_id_idempotency_key_key" ON "workouts"("athlete_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_exercises_workout_id_sort_order_key" ON "workout_exercises"("workout_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_workout_exercise_id_set_number_key" ON "workout_sets"("workout_exercise_id", "set_number");

-- AddForeignKey
ALTER TABLE "refresh_token_families" ADD CONSTRAINT "refresh_token_families_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "refresh_token_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_copied_from_exercise_id_fkey" FOREIGN KEY ("copied_from_exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_muscle_group_id_fkey" FOREIGN KEY ("muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_equipments" ADD CONSTRAINT "exercise_equipments_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_equipments" ADD CONSTRAINT "exercise_equipments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_trainer_access" ADD CONSTRAINT "exercise_trainer_access_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_trainer_access" ADD CONSTRAINT "exercise_trainer_access_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_athlete_assignments" ADD CONSTRAINT "exercise_athlete_assignments_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_athlete_assignments" ADD CONSTRAINT "exercise_athlete_assignments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_athlete_assignments" ADD CONSTRAINT "exercise_athlete_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_athletes" ADD CONSTRAINT "trainer_athletes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_athletes" ADD CONSTRAINT "trainer_athletes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_athletes" ADD CONSTRAINT "trainer_athletes_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_athletes" ADD CONSTRAINT "trainer_athletes_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_versions" ADD CONSTRAINT "training_program_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_workouts" ADD CONSTRAINT "training_program_workouts_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "training_program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_exercises" ADD CONSTRAINT "training_program_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "training_program_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_exercises" ADD CONSTRAINT "training_program_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_sets" ADD CONSTRAINT "training_program_sets_program_exercise_id_fkey" FOREIGN KEY ("program_exercise_id") REFERENCES "training_program_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_assignments" ADD CONSTRAINT "training_program_assignments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "training_program_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_assignments" ADD CONSTRAINT "training_program_assignments_trainer_athlete_id_fkey" FOREIGN KEY ("trainer_athlete_id") REFERENCES "trainer_athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_assignments" ADD CONSTRAINT "training_program_assignments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_assignments" ADD CONSTRAINT "training_program_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_assignments" ADD CONSTRAINT "training_program_assignments_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_program_assignment_id_fkey" FOREIGN KEY ("program_assignment_id") REFERENCES "training_program_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_program_workout_id_fkey" FOREIGN KEY ("program_workout_id") REFERENCES "training_program_workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual PostgreSQL constraints not represented by Prisma Schema.
-- Preserve the rule that at least one measured body metric must be present.
ALTER TABLE "body_measurements"
  ADD CONSTRAINT "body_measurements_at_least_one_metric"
  CHECK (
    "weight_kg" IS NOT NULL OR
    "body_fat_pct" IS NOT NULL OR
    "chest_cm" IS NOT NULL OR
    "waist_cm" IS NOT NULL OR
    "hips_cm" IS NOT NULL OR
    "arm_cm" IS NOT NULL OR
    "thigh_cm" IS NOT NULL
  );
