-- CreateEnum
CREATE TYPE "TwoFactorTokenPurpose" AS ENUM ('SETUP', 'LOGIN');

-- AlterTable
ALTER TABLE "TwoFactorToken" ADD COLUMN     "purpose" "TwoFactorTokenPurpose" NOT NULL DEFAULT 'SETUP';
