import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { publishDueScheduledArticles } from "@/lib/articles/publish-scheduler";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getSiteConfig();
  const BASE_URL = config.url.replace(/\/$/, "");
  await publishDueScheduledArticles();
  type ArticleEntry = { slug: string; updatedAt: Date | null; publishedAt: Date | null };
  type PageEntry = { slug: string; updatedAt: Date | null; publishedAt: Date | null };
  type TaxonomyEntry = { slug: string; updatedAt: Date | null };

  const [articles, pages, categories, tags] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { updatedAt: "desc" },
    }) as Promise<ArticleEntry[]>,
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { updatedAt: "desc" },
    }) as Promise<PageEntry[]>,
    prisma.category.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }) as Promise<TaxonomyEntry[]>,
    prisma.tag.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }) as Promise<TaxonomyEntry[]>,
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/articles`,
      lastModified: articles[0]?.updatedAt ?? new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  const coerceDate = (input: Date | string | null | undefined) => (input ? new Date(input) : undefined);

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article: ArticleEntry) => ({
    url: `${BASE_URL}/articles/${article.slug}`,
    lastModified: coerceDate(article.updatedAt ?? article.publishedAt ?? new Date()),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const pageRoutes: MetadataRoute.Sitemap = pages.map((page: PageEntry) => ({
    url: `${BASE_URL}/pages/${page.slug}`,
    lastModified: coerceDate(page.updatedAt ?? page.publishedAt ?? new Date()),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category: TaxonomyEntry) => ({
    url: `${BASE_URL}/categories/${category.slug}`,
    lastModified: coerceDate(category.updatedAt),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map((tag: TaxonomyEntry) => ({
    url: `${BASE_URL}/tags/${tag.slug}`,
    lastModified: coerceDate(tag.updatedAt),
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...articleRoutes, ...pageRoutes, ...categoryRoutes, ...tagRoutes];
}
