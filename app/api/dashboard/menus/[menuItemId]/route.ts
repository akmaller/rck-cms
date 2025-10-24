import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { menuItemUpdateSchema } from "@/lib/validators/menu";
import { writeAuditLog } from "@/lib/audit/log";

function serialize(item: Awaited<ReturnType<typeof prisma.menuItem.findUnique>>) {
  if (!item) return null;
  return {
    id: item.id,
    menu: item.menu,
    title: item.title,
    slug: item.slug,
    url: item.url,
    icon: item.icon,
    order: item.order,
    parentId: item.parentId,
    pageId: item.pageId,
    isExternal: item.isExternal,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ menuItemId: string }> }
) {
  const { menuItemId } = await context.params;
  await assertRole("ADMIN");

  const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!item) {
    return NextResponse.json({ error: "Menu item tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ data: serialize(item) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ menuItemId: string }> }
) {
  const { menuItemId } = await context.params;
  await assertRole("ADMIN");

  const payload = await request.json().catch(() => null);
  const parsed = menuItemUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const existing = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!existing) {
    return NextResponse.json({ error: "Menu item tidak ditemukan" }, { status: 404 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.menuItem.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.menu !== existing.menu) {
      return NextResponse.json({ error: "Parent menu tidak valid" }, { status: 400 });
    }
  }

  if (parsed.data.pageId && parsed.data.url) {
    return NextResponse.json(
      { error: "Pilih salah satu antara URL kustom atau tautan ke halaman" },
      { status: 400 }
    );
  }

  const updated = await prisma.menuItem.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title ?? existing.title,
      slug:
        parsed.data.slug !== undefined
          ? parsed.data.slug.trim().length > 0
            ? parsed.data.slug.trim()
            : null
          : existing.slug,
      url:
        parsed.data.url !== undefined
          ? parsed.data.url.trim().length > 0
            ? parsed.data.url.trim()
            : null
          : existing.url,
      icon:
        parsed.data.icon !== undefined
          ? parsed.data.icon.trim().length > 0
            ? parsed.data.icon.trim()
            : null
          : existing.icon,
      order: parsed.data.order ?? existing.order,
      parentId: parsed.data.parentId ?? existing.parentId,
      pageId: parsed.data.pageId ?? existing.pageId,
      isExternal:
        parsed.data.isExternal ?? (parsed.data.url ? true : parsed.data.pageId ? false : existing.isExternal),
    },
  });

  await writeAuditLog({
    action: "MENU_ITEM_UPDATE",
    entity: "MenuItem",
    entityId: updated.id,
    metadata: { title: updated.title, menu: updated.menu },
  });

  revalidatePath("/");
  revalidatePath("/dashboard/menus");
  revalidatePath(`/dashboard/menus?menu=${existing.menu}`);
  revalidatePath("/dashboard");

  return NextResponse.json({ data: serialize(updated) });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ menuItemId: string }> }
) {
  const { menuItemId } = await context.params;
  await assertRole("ADMIN");

  try {
    await prisma.$transaction([
      prisma.menuItem.deleteMany({ where: { parentId: menuItemId } }),
      prisma.menuItem.delete({ where: { id: menuItemId } }),
    ]);
  } catch {
    return NextResponse.json({ error: "Menu item tidak ditemukan" }, { status: 404 });
  }

  await writeAuditLog({
    action: "MENU_ITEM_DELETE",
    entity: "MenuItem",
    entityId: menuItemId,
  });

  revalidatePath("/");
  revalidatePath("/dashboard/menus");
  revalidatePath("/dashboard");

  return NextResponse.json({ message: "Menu item dihapus" });
}
