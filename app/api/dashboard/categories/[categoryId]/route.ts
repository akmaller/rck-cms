import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { categoryUpdateSchema } from "@/lib/validators/category";
import { writeAuditLog } from "@/lib/audit/log";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 30;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;
  await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      articleCount: category._count.articles,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const rateKey = `category_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  const updates: {
    name?: string;
    slug?: string;
    description?: string | null;
  } = {};

  if (parsed.data.name) {
    updates.name = parsed.data.name;
  }

  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description ?? null;
  }

  if (parsed.data.slug) {
    const baseSlug = slugify(
      parsed.data.slug.length > 2 ? parsed.data.slug : parsed.data.name ?? existing.name
    );
    const safeBase = baseSlug.length > 0 ? baseSlug : `kategori-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const match = await prisma.category.findUnique({ where: { slug: candidate } });
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

  const category = await prisma.category.update({
    where: { id: existing.id },
    data: updates,
  });

  await writeAuditLog({
    action: "CATEGORY_UPDATE",
    entity: "Category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  revalidateTag("content");

  return NextResponse.json({
    data: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const rateKey = `category_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  try {
    await prisma.category.delete({ where: { id: categoryId } });
  } catch {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  await writeAuditLog({
    action: "CATEGORY_DELETE",
    entity: "Category",
    entityId: categoryId,
  });

  revalidateTag("content");

  return NextResponse.json({ message: "Kategori dihapus" });
}
