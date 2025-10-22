import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  entity: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function GET(request: NextRequest) {
  await assertRole(["EDITOR", "ADMIN"]);

  const parsed = listQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Parameter tidak valid" },
      { status: 400 }
    );
  }

  const { page, perPage, entity, action, userId } = parsed.data;

  const where = {
    entity: entity || undefined,
    action: action || undefined,
    userId: userId || undefined,
    createdAt: from || to ? {
      gte: from,
      lte: to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000) : undefined,
    } : undefined,
  } satisfies Parameters<typeof prisma.auditLog.findMany>[0]["where"];

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      user: log.user,
      metadata: log.metadata,
      createdAt: log.createdAt,
    })),
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
}
