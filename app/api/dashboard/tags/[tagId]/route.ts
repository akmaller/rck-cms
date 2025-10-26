import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { tagUpdateSchema } from "@/lib/validators/tag";
import { writeAuditLog } from "@/lib/audit/log";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 50;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await context.params;
  await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  });

  if (!tag) {
    return NextResponse.json({ error: "Tag tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      articleCount: tag._count.articles,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await context.params;
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const rateKey = `tag_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = tagUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const existing = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!existing) {
    return NextResponse.json({ error: "Tag tidak ditemukan" }, { status: 404 });
  }

  const updates: { name?: string; slug?: string } = {};

  if (parsed.data.name) {
    updates.name = parsed.data.name;
  }

  if (parsed.data.slug) {
    const baseSlug = slugify(
      parsed.data.slug.length > 1 ? parsed.data.slug : parsed.data.name ?? existing.name
    );
    const safeBase = baseSlug.length > 0 ? baseSlug : `tag-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const match = await prisma.tag.findUnique({ where: { slug: candidate } });
      if (!match || match.id === existing.id) {
        break;
      }
      candidate = `${safeBase}-${counter++}`;
    }
    updates.slug = candidate;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Tidak ada perubahan" });
  }

  const tag = await prisma.tag.update({
    where: { id: existing.id },
    data: updates,
  });

  await writeAuditLog({
    action: "TAG_UPDATE",
    entity: "Tag",
    entityId: tag.id,
    metadata: { name: tag.name },
  });

  revalidateTag("content");

  return NextResponse.json({
    data: {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await context.params;
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const rateKey = `tag_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  try {
    await prisma.tag.delete({ where: { id: tagId } });
  } catch {
    return NextResponse.json({ error: "Tag tidak ditemukan" }, { status: 404 });
  }

  await writeAuditLog({
    action: "TAG_DELETE",
    entity: "Tag",
    entityId: tagId,
  });

  revalidateTag("content");

  return NextResponse.json({ message: "Tag dihapus" });
}
