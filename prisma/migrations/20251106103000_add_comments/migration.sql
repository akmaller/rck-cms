-- Create comment status enum
CREATE TYPE "CommentStatus" AS ENUM ('PUBLISHED', 'PENDING', 'ARCHIVED');

-- Create comments table
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Comment_articleId_status_createdAt_idx"
    ON "Comment" ("articleId", "status", "createdAt");

CREATE INDEX "Comment_userId_createdAt_idx"
    ON "Comment" ("userId", "createdAt");
