import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

const reorderSchema = z.object({
  menu: z.string().min(1),
  items: z
    .array(
      z.object({
        id: z.string().cuid(),
        parentId: z.string().cuid().nullable(),
        order: z.number().int().nonnegative(),
      })
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  await assertRole("ADMIN");

  const payload = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const { menu, items } = parsed.data;

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.menuItem.update({
        where: { id: item.id },
        data: { parentId: item.parentId, order: item.order },
      });
    }
  });

  await writeAuditLog({
    action: "MENU_ITEM_REORDER",
    entity: "MenuItem",
    entityId: menu,
    metadata: { menu, total: items.length },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/menus");
  revalidatePath(`/dashboard/menus?menu=${menu}`);

  return NextResponse.json({ success: true });
}
