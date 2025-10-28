import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuditLogInput = {
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue | null;
  userId?: string;
};

type PendingLog = {
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;
  userId: string | null;
  createdAt: Date;
};

const globalScope = globalThis as unknown as {
  __auditLogQueue?: PendingLog[];
  __auditLogFlusher?: NodeJS.Timeout;
  __auditLogAlways?: Set<string>;
  __auditLogEnabled?: boolean;
};

const AUDIT_FLUSH_INTERVAL_MS = 5_000;
const AUDIT_BATCH_SIZE = 25;

function resolveFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function getAuditLogEnabled(): boolean {
  if (typeof globalScope.__auditLogEnabled === "boolean") {
    return globalScope.__auditLogEnabled;
  }
  const enabled = resolveFlag(process.env.AUDIT_LOG_ENABLED, true);
  globalScope.__auditLogEnabled = enabled;
  return enabled;
}

function getAlwaysLoggedActions(): Set<string> {
  if (globalScope.__auditLogAlways) {
    return globalScope.__auditLogAlways;
  }
  const raw = process.env.AUDIT_LOG_ALWAYS_ACTIONS ?? "";
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toUpperCase());
  const set = new Set(list);
  globalScope.__auditLogAlways = set;
  return set;
}

function getQueue(): PendingLog[] {
  if (!globalScope.__auditLogQueue) {
    globalScope.__auditLogQueue = [];
  }
  return globalScope.__auditLogQueue;
}

async function flushQueue() {
  const queue = getQueue();
  if (queue.length === 0) {
    return;
  }

  const batch = queue.splice(0, AUDIT_BATCH_SIZE);

  try {
    await prisma.auditLog.createMany({
      data: batch.map((item) => ({
        action: item.action,
        entity: item.entity,
        entityId: item.entityId,
        userId: item.userId,
        metadata: item.metadata ?? Prisma.JsonNull,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to persist audit log batch", error);
    queue.unshift(...batch);
  }

  if (queue.length > 0) {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (globalScope.__auditLogFlusher) {
    return;
  }
  globalScope.__auditLogFlusher = setTimeout(async () => {
    globalScope.__auditLogFlusher = undefined;
    await flushQueue();
  }, AUDIT_FLUSH_INTERVAL_MS);
}

export async function flushAuditLogsImmediately() {
  if (globalScope.__auditLogFlusher) {
    clearTimeout(globalScope.__auditLogFlusher);
    globalScope.__auditLogFlusher = undefined;
  }
  await flushQueue();
}

export async function writeAuditLog(entry: AuditLogInput) {
  const alwaysLogged = getAlwaysLoggedActions();
  const isEnabled = getAuditLogEnabled();
  const actionKey = entry.action.toUpperCase();

  if (!isEnabled && !alwaysLogged.has(actionKey)) {
    return;
  }

  const session = await auth();
  const userId = entry.userId ?? session?.user?.id ?? null;

  const queue = getQueue();
  const normalizedMetadata =
    entry.metadata === undefined ? undefined : entry.metadata ?? Prisma.JsonNull;

  queue.push({
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    metadata: normalizedMetadata,
    userId,
    createdAt: new Date(),
  });

  if (queue.length >= AUDIT_BATCH_SIZE) {
    await flushQueue();
  } else {
    scheduleFlush();
  }
}
