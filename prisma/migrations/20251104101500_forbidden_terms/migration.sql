-- CreateTable
CREATE TABLE "ForbiddenTerm" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "normalizedPhrase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "ForbiddenTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForbiddenTerm_normalizedPhrase_key" ON "ForbiddenTerm"("normalizedPhrase");

-- CreateIndex
CREATE INDEX "ForbiddenTerm_createdAt_idx" ON "ForbiddenTerm"("createdAt");

-- AddForeignKey
ALTER TABLE "ForbiddenTerm" ADD CONSTRAINT "ForbiddenTerm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
