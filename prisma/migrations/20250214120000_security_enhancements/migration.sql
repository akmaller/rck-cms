-- Create table for storing dynamic security policy values
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecurityPolicy_key_key" ON "SecurityPolicy" ("key");

-- Create table for storing IP addresses that are temporarily blocked
CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "category" TEXT,
    "blockedUntil" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlockedIp_ip_key" ON "BlockedIp" ("ip");

-- Create table for tracking rate limit counters per IP / identifier
CREATE TABLE "RateLimitRecord" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "windowStart" TIMESTAMP WITH TIME ZONE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "RateLimitRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimitRecord_type_identifier_windowStart_key"
    ON "RateLimitRecord" ("type", "identifier", "windowStart");
