"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth, type RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

type SearchResult = {
  id: string;
  type: "ARTICLE" | "USER" | "PAGE";
  title: string;
  description?: string | null;
  href: string;
};

const MAX_RESULTS = 10;

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const role = ((session.user.role as RoleKey) ?? "AUTHOR") as RoleKey;
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResult[] });
  }

  const results: SearchResult[] = [];

  if (role === "ADMIN") {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 5,
    });

    for (const user of users) {
      results.push({
        id: user.id,
        type: "USER",
        title: user.name ?? user.email ?? "Pengguna",
        description: user.email ?? undefined,
        href: `/dashboard/users/${user.id}`,
      });
    }
  }

  const remainingForArticles = Math.max(0, MAX_RESULTS - results.length);
  if (remainingForArticles > 0) {
    const articleWhere: Prisma.ArticleWhereInput = {
      ...(role === "AUTHOR" ? { authorId: session.user.id } : {}),
      OR: [
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        {
          categories: {
            some: {
              category: { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            },
          },
        },
        {
          tags: {
            some: {
              tag: { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            },
          },
        },
        ...(role !== "AUTHOR"
          ? [
              {
                author: {
                  OR: [
                    { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                    { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
                  ],
                },
              },
            ]
          : []),
      ],
    };

    const articles = await prisma.article.findMany({
      where: articleWhere,
      take: remainingForArticles,
      orderBy: { updatedAt: "desc" },
      include: {
        author: { select: { name: true } },
        categories: { include: { category: true }, orderBy: { assignedAt: "asc" }, take: 2 },
      },
    });

    for (const article of articles) {
      const categories = article.categories
        .map((entry) => entry.category?.name)
        .filter(Boolean)
        .join(", ");
      results.push({
        id: article.id,
        type: "ARTICLE",
        title: article.title,
        description: [article.author?.name ?? "Tanpa penulis", categories].filter(Boolean).join(" • ") || undefined,
        href: `/dashboard/articles/${article.id}/edit`,
      });
      if (results.length >= MAX_RESULTS) {
        break;
      }
    }
  }

  if (results.length < MAX_RESULTS && role !== "AUTHOR") {
    const remaining = MAX_RESULTS - results.length;
    const pages = await prisma.page.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { slug: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: remaining,
    });

    for (const page of pages) {
      results.push({
        id: page.id,
        type: "PAGE",
        title: page.title,
        description: page.slug ? `/${page.slug}` : undefined,
        href: `/dashboard/pages/${page.id}/edit`,
      });
      if (results.length >= MAX_RESULTS) {
        break;
      }
    }
  }

  return NextResponse.json({ results });
}
