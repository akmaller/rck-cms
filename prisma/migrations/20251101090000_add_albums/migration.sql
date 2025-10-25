-- Create albums table
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Album"
    ADD CONSTRAINT "Album_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Album_status_createdAt_idx" ON "Album" ("status", "createdAt");
CREATE INDEX "Album_createdById_idx" ON "Album" ("createdById");

-- Create album images table
CREATE TABLE "AlbumImage" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "AlbumImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AlbumImage"
    ADD CONSTRAINT "AlbumImage_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlbumImage"
    ADD CONSTRAINT "AlbumImage_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AlbumImage_albumId_mediaId_key" ON "AlbumImage" ("albumId", "mediaId");
CREATE INDEX "AlbumImage_albumId_idx" ON "AlbumImage" ("albumId");
CREATE INDEX "AlbumImage_mediaId_idx" ON "AlbumImage" ("mediaId");
