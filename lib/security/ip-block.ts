import type { NextRequest } from "next/server";

import { getPrismaClient } from "./prisma-client";

const UNKNOWN_IP = "unknown";

export function extractClientIp(
  request: Pick<NextRequest, "headers"> & { ip?: string | null }
): string {
  const header = request.headers.get("x-forwarded-for");
  if (header) {
    const forwarded = header.split(",").map((value) => value.trim()).find(Boolean);
    if (forwarded) {
      return forwarded;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  if (request.ip) {
    return request.ip;
  }

  return UNKNOWN_IP;
}

export async function isIpBlocked(ip: string, category?: string) {
  if (!ip || ip === UNKNOWN_IP) {
    return null;
  }

  const prisma = await getPrismaClient();
  if (!prisma) {
    return null;
  }

  const record = await prisma.blockedIp.findUnique({ where: { ip } });
  if (!record) {
    return null;
  }

  if (record.blockedUntil && record.blockedUntil < new Date()) {
    await prisma.blockedIp.delete({ where: { id: record.id } });
    return null;
  }

  if (category && record.category && record.category !== category) {
    // keep block regardless of category
  }

  return record;
}

export async function blockIp(params: {
  ip: string;
  reason?: string;
  category?: string;
  durationMs: number;
}) {
  const { ip, reason, category, durationMs } = params;
  if (!ip || ip === UNKNOWN_IP) {
    return null;
  }

  const blockedUntil = new Date(Date.now() + Math.max(durationMs, 60_000));
  const prisma = await getPrismaClient();
  if (!prisma) {
    return null;
  }

  return prisma.blockedIp.upsert({
    where: { ip },
    update: {
      reason,
      category,
      blockedUntil,
    },
    create: {
      ip,
      reason,
      category,
      blockedUntil,
    },
  });
}

export async function unblockIp(ip: string) {
  if (!ip || ip === UNKNOWN_IP) {
    return;
  }
  const prisma = await getPrismaClient();
  if (!prisma) {
    return;
  }
  await prisma.blockedIp.deleteMany({ where: { ip } });
}
