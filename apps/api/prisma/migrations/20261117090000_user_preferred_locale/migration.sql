-- Account-scoped preference: NULL means follow the browser or device language.
ALTER TABLE "users" ADD COLUMN "preferred_locale" VARCHAR(10);
