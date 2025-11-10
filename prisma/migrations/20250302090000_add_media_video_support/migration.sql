-- Add support fields for video media assets
ALTER TABLE "Media"
  ADD COLUMN "duration" DOUBLE PRECISION,
  ADD COLUMN "thumbnailFileName" TEXT,
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "thumbnailWidth" INTEGER,
  ADD COLUMN "thumbnailHeight" INTEGER;
