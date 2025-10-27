import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REQUEST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_LIMIT = 2;

export type PasswordResetRequestCheck =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAt: Date };

function getExpiryDate() {
  return new Date(Date.now() + TOKEN_TTL_MS);
}

function getRequestWindowStart() {
  return new Date(Date.now() - REQUEST_WINDOW_MS);
}

export async function pruneExpiredPasswordResetTokens(userId?: string) {
  const where = userId ? { expiresAt: { lt: new Date() }, userId } : { expiresAt: { lt: new Date() } };
  await prisma.passwordResetToken.deleteMany({ where });
}

export async function checkPasswordResetRequestLimit(userId: string): Promise<PasswordResetRequestCheck> {
  const windowStart = getRequestWindowStart();
  const requests = await prisma.passwordResetToken.findMany({
    where: {
      userId,
      createdAt: { gte: windowStart },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (requests.length >= REQUEST_LIMIT) {
    const oldestInWindow = requests[Math.min(requests.length - 1, REQUEST_LIMIT - 1)];
    const retryAt = new Date(oldestInWindow.createdAt.getTime() + REQUEST_WINDOW_MS);
    return { allowed: false, retryAt };
  }

  return { allowed: true, remaining: Math.max(0, REQUEST_LIMIT - requests.length) };
}

export async function createPasswordResetToken(userId: string) {
  await pruneExpiredPasswordResetTokens(userId);

  const token = randomBytes(32).toString("hex");
  const expiresAt = getExpiryDate();

  const record = await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return record;
}

export async function findActivePasswordResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });

  if (!record) {
    return null;
  }

  if (record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  return record;
}
