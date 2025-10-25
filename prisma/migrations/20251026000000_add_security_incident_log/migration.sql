-- Create table for storing suspicious security activity
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ip" TEXT,
    "source" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityIncident_category_createdAt_idx" ON "SecurityIncident" ("category", "createdAt");
CREATE INDEX "SecurityIncident_ip_idx" ON "SecurityIncident" ("ip");
