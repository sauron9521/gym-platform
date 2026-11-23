CREATE TABLE "account_deletion_requests" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_deletion_requests_user_id_key"
  ON "account_deletion_requests"("user_id");

ALTER TABLE "account_deletion_requests"
  ADD CONSTRAINT "account_deletion_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
