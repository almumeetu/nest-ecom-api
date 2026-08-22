-- AlterTable: allow social-login accounts without a local password
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable: OAuth / social login fields
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
ALTER TABLE "users" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'local';

-- CreateIndex: one account per Google identity
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
