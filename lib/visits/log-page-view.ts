import { prisma } from "@/lib/prisma";
import { deriveDeviceInfo } from "@/lib/device-info";

export type LogPageViewInput = {
  path: string;
  url?: string | null;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

type PendingVisitLog = {
  path: string;
  url: string | null;
  referrer: string | null;
  ip: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string;
};

const VISIT_LOG_FLUSH_INTERVAL_MS = 3_000;
const VISIT_LOG_BATCH_SIZE = 50;
const VISIT_LOG_MAX_QUEUE_SIZE = 5_000;

const globalScope = globalThis as unknown as {
  __visitLogQueue?: PendingVisitLog[];
  __visitLogFlusher?: NodeJS.Timeout;
};

function sanitize(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getQueue(): PendingVisitLog[] {
  if (!globalScope.__visitLogQueue) {
    globalScope.__visitLogQueue = [];
  }
  return globalScope.__visitLogQueue;
}

function scheduleFlush() {
  if (globalScope.__visitLogFlusher) {
    return;
  }

  globalScope.__visitLogFlusher = setTimeout(() => {
    globalScope.__visitLogFlusher = undefined;
    void flushQueue();
  }, VISIT_LOG_FLUSH_INTERVAL_MS);
}

async function flushQueue() {
  const queue = getQueue();
  if (queue.length === 0) {
    return;
  }

  const batch = queue.splice(0, VISIT_LOG_BATCH_SIZE);
  try {
    await prisma.visitLog.createMany({
      data: batch,
    });
  } catch (error) {
    console.error("Failed to persist visit log batch", error);
  }

  if (queue.length > 0) {
    scheduleFlush();
  }
}

export async function logPageView({ path, url, referrer, ip, userAgent }: LogPageViewInput) {
  if (!path) {
    return;
  }

  const info = deriveDeviceInfo(userAgent ?? null);

  if (info.deviceType === "bot") {
    return;
  }

  const queue = getQueue();
  if (queue.length >= VISIT_LOG_MAX_QUEUE_SIZE) {
    queue.splice(0, Math.floor(VISIT_LOG_MAX_QUEUE_SIZE / 2));
  }

  queue.push({
    path,
    url: sanitize(url),
    referrer: sanitize(referrer),
    ip: sanitize(ip),
    userAgent: sanitize(info.userAgent),
    browser: sanitize(info.browser),
    os: sanitize(info.os),
    deviceType: info.deviceType,
  });

  if (queue.length >= VISIT_LOG_BATCH_SIZE) {
    if (globalScope.__visitLogFlusher) {
      clearTimeout(globalScope.__visitLogFlusher);
      globalScope.__visitLogFlusher = undefined;
    }
    void flushQueue();
    return;
  }

  scheduleFlush();
}
