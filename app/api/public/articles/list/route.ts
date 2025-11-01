import { NextRequest, NextResponse } from "next/server";
import { ArticleStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { articleListInclude, serializeArticleForList } from "@/lib/articles/list";

const MAX_LIMIT = 20;

type Mode = "category" | "tag" | "search" | "author";

function parseNumber(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode") as Mode | null;
  if (!mode) {
    return NextResponse.json({ error: "Parameter mode diperlukan." }, { status: 400 });
  }

  const offset = Math.max(0, parseNumber(searchParams.get("offset"), 0));
  const limit = Math.max(1, Math.min(MAX_LIMIT, parseNumber(searchParams.get("limit"), 10)));

  let where: Prisma.ArticleWhereInput;
  let overrideCategory: { name: string; slug: string } | null = null;

  switch (mode) {
    case "category": {
      const slug = searchParams.get("slug");
      if (!slug) {
        return NextResponse.json({ error: "Parameter slug kategori diperlukan." }, { status: 400 });
      }
      const category = await prisma.category.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
      });
      if (!category) {
        return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
      }
      where = {
        status: ArticleStatus.PUBLISHED,
        categories: {
          some: { categoryId: category.id },
        },
      };
      overrideCategory = { name: category.name, slug: category.slug };
      break;
    }
    case "tag": {
      const slug = searchParams.get("slug");
      if (!slug) {
        return NextResponse.json({ error: "Parameter slug tag diperlukan." }, { status: 400 });
      }
      const tag = await prisma.tag.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!tag) {
        return NextResponse.json({ error: "Tag tidak ditemukan." }, { status: 404 });
      }
      where = {
        status: ArticleStatus.PUBLISHED,
        tags: {
          some: { tagId: tag.id },
        },
      };
      break;
    }
    case "author": {
      const authorId = searchParams.get("authorId");
      if (!authorId) {
        return NextResponse.json({ error: "Parameter authorId diperlukan." }, { status: 400 });
      }
      const authorExists = await prisma.user.findUnique({
        where: { id: authorId },
        select: { id: true },
      });
      if (!authorExists) {
        return NextResponse.json({ error: "Penulis tidak ditemukan." }, { status: 404 });
      }
      where = {
        status: ArticleStatus.PUBLISHED,
        authorId,
      };
      break;
    }
    case "search": {
      const query = (searchParams.get("q") ?? "").trim();
      if (!query) {
        return NextResponse.json({ items: [] });
      }
      where = {
        status: ArticleStatus.PUBLISHED,
        OR: [
          { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { excerpt: { contains: query, mode: Prisma.QueryMode.insensitive } },
          {
            author: {
              name: { contains: query, mode: Prisma.QueryMode.insensitive },
              NOT: { role: "ADMIN" },
            },
          },
        ],
      };
      break;
    }
    default:
      return NextResponse.json({ error: "Mode tidak didukung." }, { status: 400 });
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    include: articleListInclude,
    skip: offset,
    take: limit,
  });

  const items = articles.map((article) => serializeArticleForList(article, { overrideCategory }));
  return NextResponse.json({ items });
}
