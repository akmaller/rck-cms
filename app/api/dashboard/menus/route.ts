import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { menuItemCreateSchema, menuReorderSchema } from "@/lib/validators/menu";
import { writeAuditLog } from "@/lib/audit/log";

const listQuerySchema = z.object({
  menu: z.string().min(1, "Nama menu wajib diisi").default("main"),
});

function serialize(item: Awaited<ReturnType<typeof prisma.menuItem.findMany>>[number]) {
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

export async function GET(request: NextRequest) {
  await assertRole("ADMIN");

  const parsed = listQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Parameter tidak valid" },
      { status: 400 }
    );
  }

  const items = await prisma.menuItem.findMany({
    where: { menu: parsed.data.menu },
    orderBy: [{ parentId: "asc" }, { order: "asc" }],
  });

  return NextResponse.json({
    data: items.map(serialize),
  });
}

export async function POST(request: NextRequest) {
  await assertRole("ADMIN");

  const payload = await request.json().catch(() => null);
  const parsed = menuItemCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  if (parsed.data.parentId) {
    const parent = await prisma.menuItem.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.menu !== parsed.data.menu) {
      return NextResponse.json({ error: "Parent menu tidak valid" }, { status: 400 });
    }
  }

  if (parsed.data.pageId && parsed.data.url) {
    return NextResponse.json(
      { error: "Pilih salah satu antara URL kustom atau tautan ke halaman" },
      { status: 400 }
    );
  }

  const item = await prisma.menuItem.create({
    data: {
      menu: parsed.data.menu,
      title: parsed.data.title,
      slug: parsed.data.slug,
      url: parsed.data.url,
      icon: parsed.data.icon,
      order: parsed.data.order ?? 0,
      parentId: parsed.data.parentId ?? null,
      pageId: parsed.data.pageId ?? null,
      isExternal: parsed.data.isExternal ?? Boolean(parsed.data.url),
    },
  });

  await writeAuditLog({
    action: "MENU_ITEM_CREATE",
    entity: "MenuItem",
    entityId: item.id,
    metadata: { menu: item.menu, title: item.title },
  });

  return NextResponse.json({ data: serialize(item) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  await assertRole("ADMIN");

  const payload = await request.json().catch(() => null);
  const parsed = menuReorderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  await prisma.$transaction(
    parsed.data.items.map((item) =>
      prisma.menuItem.update({
        where: { id: item.id },
        data: { order: item.order, parentId: item.parentId ?? null },
      })
    )
  );

  await writeAuditLog({
    action: "MENU_REORDER",
    entity: "Menu",
    entityId: parsed.data.items[0]?.id ?? "bulk",
    metadata: { count: parsed.data.items.length },
  });

  return NextResponse.json({ message: "Menu diperbarui" });
}
