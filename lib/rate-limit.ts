import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/security/prisma-client";

const globalScope = globalThis as unknown as {
  __rateLimitStore?: Map<string, { count: number; expiresAt: number }>;
};

const FALLBACK_RATE_LIMIT_STORE =
  globalScope.__rateLimitStore ?? new Map<string, { count: number; expiresAt: number }>();

if (!globalScope.__rateLimitStore) {
  globalScope.__rateLimitStore = FALLBACK_RATE_LIMIT_STORE;
}

function getWindowStart(windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return new Date(windowStart);
}

async function incrementPersistentCounter(key: string, limit: number, windowMs: number) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return null;
  }

  const windowStart = getWindowStart(windowMs);
  const record = await prisma.rateLimitRecord.upsert({
    where: {
      type_identifier_windowStart: {
        type: "mutation",
        identifier: key,
        windowStart,
      },
    },
    update: {
      count: { increment: 1 },
    },
    create: {
      type: "mutation",
      identifier: key,
      windowStart,
      count: 1,
      metadata: Prisma.JsonNull,
    },
  });

  return record.count > limit;
}

export async function isRateLimited(key: string, limit: number, windowMs: number) {
  if (!key) {
    return false;
  }

  const exceeded = await incrementPersistentCounter(key, limit, windowMs);
  if (exceeded !== null) {
    return exceeded;
  }

  const now = Date.now();
  const entry = FALLBACK_RATE_LIMIT_STORE.get(key);

  if (!entry || entry.expiresAt < now) {
    FALLBACK_RATE_LIMIT_STORE.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) {
    return true;
  }

  entry.count += 1;
  FALLBACK_RATE_LIMIT_STORE.set(key, entry);
  return false;
}

export async function resetRateLimit(key: string) {
  if (!key) return;

  const prisma = await getPrismaClient();
  if (prisma) {
    await prisma.rateLimitRecord.deleteMany({
      where: {
        type: "mutation",
        identifier: key,
      },
    });
  }

  FALLBACK_RATE_LIMIT_STORE.delete(key);
}
