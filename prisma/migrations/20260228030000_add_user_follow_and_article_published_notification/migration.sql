DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ARTICLE_PUBLISHED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ARTICLE_PUBLISHED';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "UserFollow" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_followerId_followingId_key"
  ON "UserFollow"("followerId", "followingId");

CREATE INDEX IF NOT EXISTS "UserFollow_followerId_createdAt_idx"
  ON "UserFollow"("followerId", "createdAt");

CREATE INDEX IF NOT EXISTS "UserFollow_followingId_createdAt_idx"
  ON "UserFollow"("followingId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserFollow_followerId_fkey'
  ) THEN
    ALTER TABLE "UserFollow"
      ADD CONSTRAINT "UserFollow_followerId_fkey"
      FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserFollow_followingId_fkey'
  ) THEN
    ALTER TABLE "UserFollow"
      ADD CONSTRAINT "UserFollow_followingId_fkey"
      FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
