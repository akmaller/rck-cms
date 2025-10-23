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

export async function writeAuditLog(entry: AuditLogInput) {
  const session = await auth();
  const userId = entry.userId ?? session?.user?.id ?? null;

  await prisma.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      userId,
      metadata: entry.metadata ?? undefined,
    },
  });
}
