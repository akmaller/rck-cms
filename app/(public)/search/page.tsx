import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArticleStatus, Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";

const PAGE_SIZE = 10;

type SearchPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const query = (resolved?.q ?? "").trim();
  const currentPage = Math.max(1, Number(resolved?.page ?? 1));
  const config = await getSiteConfig();

  if (!query) {
    return createMetadata({
      config,
      title: "Pencarian Konten",
      description: `Cari artikel dan halaman dari ${config.name}.`,
      path: "/search",
    });
  }

  const path = currentPage > 1
    ? `/search?q=${encodeURIComponent(query)}&page=${currentPage}`
    : `/search?q=${encodeURIComponent(query)}`;

  return createMetadata({
    config,
    title: `Pencarian: ${query}`,
    description: `Hasil pencarian untuk “${query}” di ${config.name}.`,
    path,
    keywords: [query],
  });
}

function buildPaginationLinks({
  current,
  total,
  basePath,
  query,
}: {
  current: number;
  total: number;
  basePath: string;
  query: string;
}) {
  const items: Array<{ label: string; href: string; active: boolean } | "ellipsis"> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      items.push({ label: `${i}`, href: `${basePath}?q=${encodeURIComponent(query)}&page=${i}`, active: i === current });
    } else if (items[items.length - 1] !== "ellipsis") {
      items.push("ellipsis");
    }
  }
  return items;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = (resolved.q ?? "").trim();
  const currentPage = Math.max(1, Number(resolved.page ?? 1));

  const queryParams = new URLSearchParams();
  if (query) queryParams.set("q", query);
  if (resolved.page && resolved.page !== "1") {
    queryParams.set("page", resolved.page);
  }
  const pathWithQuery = queryParams.toString() ? `/search?${queryParams.toString()}` : "/search";
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const url = host ? `${protocol}://${host}${pathWithQuery}` : undefined;

  await logPageView({ path: pathWithQuery, url, referrer, ip, userAgent });

  if (!query) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pencarian Konten</h1>
          <p className="text-muted-foreground">Cari artikel berdasarkan judul dan ringkasan.</p>
        </div>
        <SearchForm defaultValue="" />
      </section>
    );
  }

  const where: Prisma.ArticleWhereInput = {
    status: ArticleStatus.PUBLISHED,
    OR: [
      { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { excerpt: { contains: query, mode: Prisma.QueryMode.insensitive } },
    ],
  };

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagination = buildPaginationLinks({ current: currentPage, total: totalPages, basePath: "/search", query });

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Pencarian</h1>
        <SearchForm defaultValue={query} />
        <p className="text-sm text-muted-foreground">Menampilkan {articles.length} dari {totalCount} hasil untuk “{query}”.</p>
      </div>

      <div className="grid gap-3">
        {articles.map((article) => (
          <Card key={article.id}>
            <CardHeader>
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                Dipublikasikan {article.publishedAt?.toLocaleDateString("id-ID") ?? "-"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{article.excerpt ?? "Belum ada ringkasan."}</p>
              <Button asChild size="sm" className="w-fit">
                <Link href={`/articles/${article.slug}`}>Baca Artikel</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Hasil tidak ditemukan</CardTitle>
            <CardDescription>Coba kata kunci lain atau lihat artikel terbaru.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants({ variant: "outline" })} href="/articles">
              Artikel Terbaru
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {totalPages > 1 ? (
        <nav className="flex items-center gap-2" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={currentPage === 1}>
            <Link href={`/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}>Sebelumnya</Link>
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
            <Link href={`/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}>Berikutnya</Link>
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

type SearchFormProps = {
  defaultValue: string;
};

function SearchForm({ defaultValue }: SearchFormProps) {
  return (
    <form action="/search" className="grid gap-2 sm:flex sm:items-center sm:gap-4">
      <div className="w-full space-y-2 sm:max-w-lg">
        <Label htmlFor="search">Kata kunci</Label>
        <Input
          id="search"
          name="q"
          placeholder="cari artikel..."
          defaultValue={defaultValue}
          required
        />
      </div>
      <Button type="submit" className="mt-2 sm:mt-8">
        Cari
      </Button>
    </form>
  );
}
