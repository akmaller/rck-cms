import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ArticleStatus } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { menuItemCreateSchema, menuReorderSchema } from "@/lib/validators/menu";
import { writeAuditLog } from "@/lib/audit/log";
import { slugify } from "@/lib/utils/slug";

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

  if (parsed.data.categorySlug && parsed.data.pageId) {
    return NextResponse.json(
      { error: "Gunakan halaman atau kategori, bukan keduanya" },
      { status: 400 }
    );
  }

  if (parsed.data.categorySlug && parsed.data.url) {
    return NextResponse.json(
      { error: "Gunakan kategori tanpa URL kustom" },
      { status: 400 }
    );
  }

  if (parsed.data.albumId && parsed.data.pageId) {
    return NextResponse.json(
      { error: "Gunakan album atau halaman, bukan keduanya" },
      { status: 400 }
    );
  }

  if (parsed.data.albumId && parsed.data.categorySlug) {
    return NextResponse.json(
      { error: "Gunakan album atau kategori, bukan keduanya" },
      { status: 400 }
    );
  }

  if (parsed.data.albumId && parsed.data.url) {
    return NextResponse.json(
      { error: "Gunakan album tanpa URL kustom" },
      { status: 400 }
    );
  }

  let pageId: string | null = parsed.data.pageId ?? null;
  let targetSlug: string | null = null;
  let targetUrl: string | null = null;
  let isExternal = parsed.data.isExternal ?? false;

  if (pageId) {
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      return NextResponse.json({ error: "Halaman tidak ditemukan" }, { status: 404 });
    }
    targetSlug = `pages/${page.slug}`;
    targetUrl = null;
    pageId = page.id;
    isExternal = false;
  } else if (parsed.data.categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: parsed.data.categorySlug } });
    if (!category) {
      return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    }
    targetSlug = `categories/${category.slug}`;
    targetUrl = null;
    pageId = null;
    isExternal = false;
  } else if (parsed.data.albumId) {
    const album = await prisma.album.findFirst({
      where: { id: parsed.data.albumId, status: ArticleStatus.PUBLISHED },
    });
    if (!album) {
      return NextResponse.json({ error: "Album tidak ditemukan atau belum dipublikasikan" }, { status: 404 });
    }
    targetSlug = `albums/${album.id}`;
    targetUrl = null;
    pageId = null;
    isExternal = false;
  } else {
    const normalizeUrl = (value: string | undefined | null) => {
      if (!value) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    const manualUrl = normalizeUrl(parsed.data.url);
    const manualSlugInput = parsed.data.slug ? slugify(parsed.data.slug) : "";
    const baseTitleSlug = slugify(parsed.data.title);

    if (manualUrl) {
      targetUrl = manualUrl;
    }

    if (manualSlugInput) {
      const base = manualSlugInput;
      let candidate = base;
      let counter = 1;
      while (
        await prisma.menuItem.findFirst({
          where: { menu: parsed.data.menu, slug: candidate },
        })
      ) {
        candidate = `${base}-${counter++}`;
      }
      targetSlug = candidate;
    } else if (!targetUrl) {
      const base = baseTitleSlug || `menu-${Date.now()}`;
      let candidate = base;
      let counter = 1;
      while (
        await prisma.menuItem.findFirst({
          where: { menu: parsed.data.menu, slug: candidate },
        })
      ) {
        candidate = `${base}-${counter++}`;
      }
      targetSlug = candidate;
    }

    if (targetUrl) {
      isExternal = !targetUrl.startsWith("/");
    } else {
      isExternal = false;
    }
  }

  const item = await prisma.menuItem.create({
    data: {
      menu: parsed.data.menu,
      title: parsed.data.title,
      slug: targetSlug,
      url: targetUrl,
      icon: parsed.data.icon,
      order: parsed.data.order ?? 0,
      parentId: parsed.data.parentId ?? null,
      pageId,
      isExternal,
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
