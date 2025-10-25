import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArticleStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";

const PAGE_SIZE = 6;

type TagPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!tag) {
    return createMetadata({
      title: "Tag tidak ditemukan",
      description: "Tag yang Anda cari tidak tersedia.",
      path: `/tags/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  const currentPage = Math.max(1, Number(query?.page ?? 1));
  const config = await getSiteConfig();
  const baseTitle = `Tag: ${tag.name}`;
  const title = currentPage > 1 ? `${baseTitle} — Halaman ${currentPage}` : baseTitle;
  const description = `Artikel dengan tag ${tag.name} dari ${config.name}.`;
  const path = currentPage > 1 ? `/tags/${slug}?page=${currentPage}` : `/tags/${slug}`;

  return createMetadata({
    config,
    title,
    description,
    path,
    keywords: [tag.name],
    tags: [tag.name],
  });
}

function buildPaginationLinks({
  current,
  total,
  basePath,
}: {
  current: number;
  total: number;
  basePath: string;
}) {
  const pages: Array<{ label: string; href: string; active: boolean } | "ellipsis"> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      pages.push({ label: `${i}`, href: `${basePath}?page=${i}`, active: i === current });
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }
  return pages;
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const currentPage = Math.max(1, Number(query.page ?? 1));

  const tag = await prisma.tag.findUnique({
    where: { slug },
  });

  if (!tag) {
    notFound();
  }

  const whereClause = {
    status: ArticleStatus.PUBLISHED,
    tags: {
      some: {
        tag: {
          slug,
        },
      },
    },
  } as const;

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where: whereClause,
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where: whereClause }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagination = buildPaginationLinks({
    current: currentPage,
    total: totalPages,
    basePath: `/tags/${slug}`,
  });

  const queryParams = new URLSearchParams();
  if (query.page && query.page !== "1") {
    queryParams.set("page", query.page);
  }
  const pathWithQuery = queryParams.toString() ? `/tags/${slug}?${queryParams.toString()}` : `/tags/${slug}`;
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const url = host ? `${protocol}://${host}${pathWithQuery}` : undefined;

  await logPageView({ path: pathWithQuery, url, referrer, ip, userAgent });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Kembali ke Beranda
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Tag: {tag.name}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Card key={article.id} className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="line-clamp-2 text-lg">{article.title}</CardTitle>
              <CardDescription>
                Dipublikasikan {article.publishedAt?.toLocaleDateString("id-ID") ?? "-"} oleh {article.author?.name ?? "Anonim"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <p className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt ?? "Belum ada ringkasan."}</p>
              <Button asChild size="sm">
                <Link href={`/articles/${article.slug}`}>Baca Artikel</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada artikel</CardTitle>
            <CardDescription>
              Konten untuk tag ini akan segera hadir. Sementara, jelajahi artikel lain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants({ variant: "outline" })} href="/articles">
              Lihat semua artikel
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {totalPages > 1 ? (
        <nav className="flex items-center gap-2" aria-label="Pagination">
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
          >
            <Link href={`/tags/${slug}?page=${currentPage - 1}`}>Sebelumnya</Link>
          </Button>
          <div className="flex items-center gap-1">
            {pagination.map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className={buttonVariants({
                    variant: item.active ? "default" : "ghost",
                    size: "sm",
                  })}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
          >
            <Link href={`/tags/${slug}?page=${currentPage + 1}`}>Berikutnya</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
