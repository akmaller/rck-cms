import { ArticleStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils/slug";
import { pageUpdateSchema } from "@/lib/validators/page";
import { writeAuditLog } from "@/lib/audit/log";

type PageDetail = Prisma.PageGetPayload<{
  include: {
    author: { select: { id: true; name: true; email: true } };
    featuredMedia: true;
  };
}>;

function serialize(page: PageDetail | null) {
  if (!page) return null;
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    excerpt: page.excerpt,
    content: page.content,
    status: page.status,
    publishedAt: page.publishedAt,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    author: page.author,
    featuredMediaId: page.featuredMediaId,
    featuredMedia: page.featuredMedia,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await context.params;
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      featuredMedia: true,
    },
  });

  if (!page) {
    return NextResponse.json({ error: "Halaman tidak ditemukan" }, { status: 404 });
  }

  if (session.user.role === "AUTHOR" && page.authorId !== session.user.id) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  return NextResponse.json({ data: serialize(page) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await context.params;
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const payload = await request.json().catch(() => null);
  const parsed = pageUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) {
    return NextResponse.json({ error: "Halaman tidak ditemukan" }, { status: 404 });
  }

  if (session.user.role === "AUTHOR" && page.authorId !== session.user.id) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  if (parsed.data.featuredMediaId) {
    const mediaExists = await prisma.media.findUnique({ where: { id: parsed.data.featuredMediaId } });
    if (!mediaExists) {
      return NextResponse.json({ error: "Media unggulan tidak ditemukan" }, { status: 400 });
    }
  }

  const updates: Prisma.PageUpdateInput = {};

  if (parsed.data.title) updates.title = parsed.data.title;
  if (parsed.data.excerpt !== undefined) updates.excerpt = parsed.data.excerpt ?? null;
  if (parsed.data.content) {
    updates.content = parsed.data.content as Prisma.InputJsonValue;
  }

  if (parsed.data.status) {
    updates.status = parsed.data.status;
    updates.publishedAt =
      parsed.data.status === ArticleStatus.PUBLISHED
        ? parsed.data.publishedAt ?? page.publishedAt ?? new Date()
        : parsed.data.publishedAt ?? null;
  } else if (parsed.data.publishedAt) {
    updates.publishedAt = parsed.data.publishedAt;
  }

  if (parsed.data.slug) {
    const baseSlug = slugify(parsed.data.slug.length > 0 ? parsed.data.slug : parsed.data.title ?? page.title);
    const safeBase = baseSlug.length > 0 ? baseSlug : `halaman-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const exists = await prisma.page.findUnique({ where: { slug: candidate } });
      if (!exists || exists.id === page.id) {
        break;
      }
      candidate = `${safeBase}-${counter++}`;
    }
    updates.slug = candidate;
  }

  if (parsed.data.featuredMediaId !== undefined) {
    updates.featuredMedia = parsed.data.featuredMediaId
      ? { connect: { id: parsed.data.featuredMediaId } }
      : { disconnect: true };
  }

  const updated = await prisma.page.update({
    where: { id: page.id },
    data: updates,
    include: {
      author: { select: { id: true, name: true, email: true } },
      featuredMedia: true,
    },
  });

  await writeAuditLog({
    action: "PAGE_UPDATE",
    entity: "Page",
    entityId: updated.id,
    metadata: { title: updated.title, featuredMediaId: updated.featuredMediaId ?? null },
  });

  revalidateTag("content");
  return NextResponse.json({ data: serialize(updated) });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await context.params;
  await assertRole(["EDITOR", "ADMIN"]);

  try {
    await prisma.$transaction([
      prisma.menuItem.updateMany({ where: { pageId }, data: { pageId: null } }),
      prisma.page.delete({ where: { id: pageId } }),
    ]);
  } catch {
    return NextResponse.json({ error: "Halaman tidak ditemukan" }, { status: 404 });
  }

  await writeAuditLog({
    action: "PAGE_DELETE",
    entity: "Page",
    entityId: pageId,
  });

  revalidateTag("content");
  return NextResponse.json({ message: "Halaman dihapus" });
}
