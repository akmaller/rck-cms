import { Prisma } from "@prisma/client";

import { getPrismaClient } from "./prisma-client";

export type SecurityIncidentInput = {
  category: string;
  ip?: string | null;
  source?: string | null;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function logSecurityIncident(input: SecurityIncidentInput) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return;
  }

  await prisma.securityIncident.create({
    data: {
      category: input.category,
      ip: input.ip ?? null,
      source: input.source ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function getRecentSecurityIncidents(limit = 50) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return [];
  }

  return prisma.securityIncident.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 200)),
  });
}
