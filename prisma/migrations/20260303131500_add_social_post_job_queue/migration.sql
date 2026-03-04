-- CreateEnum
CREATE TYPE "SocialPostJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "SocialPostJob" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "articleId" TEXT NOT NULL,
    "status" "SocialPostJobStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "postedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPostJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostJob_idempotencyKey_key" ON "SocialPostJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SocialPostJob_status_createdAt_idx" ON "SocialPostJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPostJob_articleId_createdAt_idx" ON "SocialPostJob"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPostJob_platform_status_idx" ON "SocialPostJob"("platform", "status");

-- AddForeignKey
ALTER TABLE "SocialPostJob" ADD CONSTRAINT "SocialPostJob_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
