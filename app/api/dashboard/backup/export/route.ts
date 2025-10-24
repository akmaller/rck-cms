"use server";

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

const SECTION_MAP = {
  config: "config",
  articles: "articles",
  pages: "pages",
  users: "users",
  media: "media",
  audits: "audits",
} as const;

type SectionKey = keyof typeof SECTION_MAP;

export async function GET(request: Request) {
  const session = await requireAuth();
  const role = session.user.role ?? "AUTHOR";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const typesParam = url.searchParams.get("types");
  const requested = typesParam
    ? typesParam
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is SectionKey => value in SECTION_MAP)
    : (Object.keys(SECTION_MAP) as SectionKey[]);

  const selected = requested.length > 0 ? Array.from(new Set(requested)) : (Object.keys(SECTION_MAP) as SectionKey[]);
  const includeConfig = selected.includes("config");
  const includeArticles = selected.includes("articles");
  const includePages = selected.includes("pages");
  const includeUsers = selected.includes("users");
  const includeMedia = selected.includes("media");
  const includeAudits = selected.includes("audits");

  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    sections: selected,
  };

  if (includeConfig) {
    const siteConfigs = await prisma.siteConfig.findMany();
    payload.siteConfig = siteConfigs.reduce<Record<string, unknown>>((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {});
  }

  if (includeArticles) {
    const articles = await prisma.article.findMany({
      include: {
        author: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        featuredMedia: true,
      },
    });
    payload.articles = articles.map((article) => ({
      ...article,
      publishedAt: serializeDate(article.publishedAt),
      createdAt: serializeDate(article.createdAt),
      updatedAt: serializeDate(article.updatedAt),
    }));
  }

  if (includePages) {
    const pages = await prisma.page.findMany({
      include: {
        author: true,
        menuItems: true,
        featuredMedia: true,
      },
    });
    payload.pages = pages.map((page) => ({
      ...page,
      publishedAt: serializeDate(page.publishedAt),
      createdAt: serializeDate(page.createdAt),
      updatedAt: serializeDate(page.updatedAt),
    }));
  }

  if (includeUsers) {
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
        sessions: true,
        articles: true,
        pages: true,
      },
    });
    payload.users = users.map((user) => ({
      ...user,
      createdAt: serializeDate(user.createdAt),
      updatedAt: serializeDate(user.updatedAt),
    }));
  }

  if (includeMedia) {
    const media = await prisma.media.findMany({
      include: {
        article: true,
        pages: true,
        createdBy: true,
      },
    });
    payload.media = media.map((item) => ({
      ...item,
      createdAt: serializeDate(item.createdAt),
    }));
  }

  if (includeAudits) {
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });
    payload.auditLogs = auditLogs.map((log) => ({
      ...log,
      createdAt: serializeDate(log.createdAt),
    }));
  }

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="cms-backup-${Date.now()}.json"`,
    },
  });
}
