-- Additive localized catalog tables. Existing source names remain canonical fallback.
CREATE TABLE "exercise_translations" (
  "exercise_id" TEXT NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "instructions" TEXT,
  CONSTRAINT "exercise_translations_pkey" PRIMARY KEY ("exercise_id", "locale"),
  CONSTRAINT "exercise_translations_exercise_id_fkey"
    FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercise_translations_locale_check" CHECK ("locale" IN ('uk', 'en'))
);

CREATE INDEX "exercise_translations_locale_idx" ON "exercise_translations"("locale");

CREATE TABLE "muscle_group_translations" (
  "muscle_group_id" TEXT NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  CONSTRAINT "muscle_group_translations_pkey" PRIMARY KEY ("muscle_group_id", "locale"),
  CONSTRAINT "muscle_group_translations_muscle_group_id_fkey"
    FOREIGN KEY ("muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "muscle_group_translations_locale_check" CHECK ("locale" IN ('uk', 'en'))
);

CREATE TABLE "equipment_translations" (
  "equipment_id" TEXT NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  CONSTRAINT "equipment_translations_pkey" PRIMARY KEY ("equipment_id", "locale"),
  CONSTRAINT "equipment_translations_equipment_id_fkey"
    FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "equipment_translations_locale_check" CHECK ("locale" IN ('uk', 'en'))
);
