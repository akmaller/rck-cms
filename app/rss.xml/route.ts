import { NextResponse } from "next/server";
import { ArticleStatus } from "@prisma/client";

import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/prisma";

const BASE_URL = siteConfig.url.replace(/\/$/, "");

export const revalidate = 900;

function escapeCdata(value: string) {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

export async function GET() {
  const articles = await prisma.article.findMany({
    where: { status: ArticleStatus.PUBLISHED },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      updatedAt: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const itemsXml = articles
    .map((article) => {
      const articleUrl = `${BASE_URL}/articles/${article.slug}`;
      const description = escapeCdata(
        (article.excerpt ?? "").trim() || `Artikel terbaru: ${article.title}`
      );
      const pubDate = (article.publishedAt ?? article.createdAt ?? article.updatedAt).toUTCString();

      return `
    <item>
      <title><![CDATA[${escapeCdata(article.title)}]]></title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${escapeCdata(siteConfig.name)}]]></title>
    <link>${BASE_URL}/</link>
    <description><![CDATA[${escapeCdata(siteConfig.description)}]]></description>
    <language>id-ID</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(feed, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=900, stale-while-revalidate",
    },
  });
}

