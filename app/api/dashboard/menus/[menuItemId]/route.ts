import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ArticleStatus } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { menuItemUpdateSchema } from "@/lib/validators/menu";
import { writeAuditLog } from "@/lib/audit/log";
import { slugify } from "@/lib/utils/slug";

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

  const title = parsed.data.title ?? existing.title;
  const pageIdInput = parsed.data.pageId ?? null;
  const categorySlugInput = parsed.data.categorySlug ? parsed.data.categorySlug.trim() : "";
  const albumIdInputRaw = parsed.data.albumId ?? null;
  const albumIdInput = albumIdInputRaw ? albumIdInputRaw.trim() : "";

  if (pageIdInput && parsed.data.url) {
    return NextResponse.json(
      { error: "Pilih salah satu antara URL kustom atau tautan ke halaman" },
      { status: 400 }
    );
  }

  if (pageIdInput && categorySlugInput) {
    return NextResponse.json(
      { error: "Gunakan halaman atau kategori, bukan keduanya" },
      { status: 400 }
    );
  }

  if (categorySlugInput && parsed.data.url) {
    return NextResponse.json(
      { error: "Gunakan kategori tanpa URL kustom" },
      { status: 400 }
    );
  }

  if (albumIdInput && parsed.data.url) {
    return NextResponse.json(
      { error: "Gunakan album tanpa URL kustom" },
      { status: 400 }
    );
  }

  if (albumIdInput && pageIdInput) {
    return NextResponse.json(
      { error: "Gunakan album atau halaman, bukan keduanya" },
      { status: 400 }
    );
  }

  if (albumIdInput && categorySlugInput) {
    return NextResponse.json(
      { error: "Gunakan album atau kategori, bukan keduanya" },
      { status: 400 }
    );
  }

  if (parsed.data.parentId) {
    const parent = await prisma.menuItem.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.menu !== existing.menu) {
      return NextResponse.json({ error: "Parent menu tidak valid" }, { status: 400 });
    }
  }

  let targetSlug = existing.slug;
  let targetUrl = existing.url;
  const targetIcon = parsed.data.icon !== undefined ? (parsed.data.icon.trim() || null) : existing.icon;
  const targetOrder = parsed.data.order ?? existing.order;
  const targetParentId = parsed.data.parentId ?? existing.parentId;
  let targetPageId = existing.pageId;
  let isExternal = existing.isExternal;

  if (albumIdInput) {
    const album = await prisma.album.findFirst({
      where: { id: albumIdInput, status: ArticleStatus.PUBLISHED },
    });
    if (!album) {
      return NextResponse.json({ error: "Album tidak ditemukan atau belum dipublikasikan" }, { status: 404 });
    }
    targetSlug = `albums/${album.id}`;
    targetUrl = null;
    targetPageId = null;
    isExternal = false;
  } else if (pageIdInput) {
    const page = await prisma.page.findUnique({ where: { id: pageIdInput } });
    if (!page) {
      return NextResponse.json({ error: "Halaman tidak ditemukan" }, { status: 404 });
    }
    targetSlug = `pages/${page.slug}`;
    targetUrl = null;
    targetPageId = page.id;
    isExternal = false;
  } else if (categorySlugInput) {
    const category = await prisma.category.findUnique({ where: { slug: categorySlugInput } });
    if (!category) {
      return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    }
    targetSlug = `categories/${category.slug}`;
    targetUrl = null;
    targetPageId = null;
    isExternal = false;
  } else {
    if (parsed.data.url !== undefined) {
      const url = parsed.data.url.trim();
      targetUrl = url.length > 0 ? url : null;
    }
    if (parsed.data.slug !== undefined) {
      const manual = parsed.data.slug.trim();
      if (manual.length > 0) {
        const base = slugify(manual);
        if (base) {
          let candidate = base;
          let counter = 1;
          while (
            await prisma.menuItem.findFirst({
              where: { menu: existing.menu, slug: candidate, NOT: { id: existing.id } },
            })
          ) {
            candidate = `${base}-${counter++}`;
          }
          targetSlug = candidate;
        } else {
          targetSlug = null;
        }
      } else if (!targetUrl) {
        const base = slugify(title);
        if (base) {
          let candidate = base;
          let counter = 1;
          while (
            await prisma.menuItem.findFirst({
              where: { menu: existing.menu, slug: candidate, NOT: { id: existing.id } },
            })
          ) {
            candidate = `${base}-${counter++}`;
          }
          targetSlug = candidate;
        } else {
          targetSlug = null;
        }
      } else {
        targetSlug = null;
      }
    }

    targetPageId = null;
    isExternal = targetUrl ? !targetUrl.startsWith("/") : false;
  }

  const updated = await prisma.menuItem.update({
    where: { id: existing.id },
    data: {
      title,
      slug: targetSlug,
      url: targetUrl,
      icon: targetIcon,
      order: targetOrder,
      parentId: targetParentId,
      pageId: targetPageId,
      isExternal,
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
