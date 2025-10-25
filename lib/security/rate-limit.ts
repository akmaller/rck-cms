import { Prisma } from "@prisma/client";

import { blockIp, isIpBlocked } from "./ip-block";
import { getPrismaClient } from "./prisma-client";
import { logSecurityIncident } from "./activity-log";

export type RateLimitContext = {
  type: "login" | "page" | "api" | string;
  identifier: string;
  limit: number;
  windowMs: number;
  blockDurationMs: number;
  ip: string;
  reason: string;
  metadata?: Prisma.InputJsonValue | null;
};

function getWindowStart(windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return new Date(windowStart);
}

export async function enforceRateLimit(context: RateLimitContext) {
  const { type, identifier, limit, windowMs, blockDurationMs, ip, reason, metadata } = context;

  if (!identifier) {
    return { allowed: true, count: 0 } as const;
  }

  const activeBlock = await isIpBlocked(ip, type);
  if (activeBlock) {
    return {
      allowed: false,
      blocked: true,
      retryAfter: activeBlock.blockedUntil ? Math.max(0, activeBlock.blockedUntil.getTime() - Date.now()) : undefined,
      count: Number.POSITIVE_INFINITY,
    } as const;
  }

  const prisma = await getPrismaClient();
  if (!prisma) {
    return {
      allowed: true,
      blocked: false,
      count: 0,
      remaining: limit,
      windowMs,
    } as const;
  }

  const windowStart = getWindowStart(windowMs);
  const metadataValue = metadata === undefined ? undefined : metadata ?? Prisma.JsonNull;
  const record = await prisma.rateLimitRecord.upsert({
    where: {
      type_identifier_windowStart: {
        type,
        identifier,
        windowStart,
      },
    },
    update: {
      count: { increment: 1 },
      metadata: metadataValue,
    },
    create: {
      type,
      identifier,
      windowStart,
      count: 1,
      metadata: metadataValue,
    },
  });

  if (record.count > limit) {
    const blocked = await blockIp({
      ip,
      reason,
      category: type,
      durationMs: blockDurationMs,
    });
    await logSecurityIncident({
      category: type,
      ip,
      source: "rate-limit",
      description: reason,
      metadata: {
        identifier,
        count: record.count,
        limit,
        windowMs,
        blockDurationMs,
        blockedUntil: blocked?.blockedUntil ?? null,
        metadata,
      },
    });

    return {
      allowed: false,
      blocked: true,
      retryAfter: blocked?.blockedUntil ? Math.max(0, blocked.blockedUntil.getTime() - Date.now()) : blockDurationMs,
      count: record.count,
    } as const;
  }

  return {
    allowed: true,
    blocked: false,
    count: record.count,
    remaining: Math.max(0, limit - record.count),
    windowMs,
  } as const;
}

export async function clearRateLimit(type: string, identifier: string) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return;
  }
  await prisma.rateLimitRecord.deleteMany({ where: { type, identifier } });
}
