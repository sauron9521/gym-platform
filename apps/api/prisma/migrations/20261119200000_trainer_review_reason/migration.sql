-- M05/#311: keep the approval reason immutable when revoking a trainer profile.
-- Additive; previously revoked rows remain valid with NULL revoke_reason.
ALTER TABLE "trainer_applications"
  ADD COLUMN "revoke_reason" VARCHAR(500);
