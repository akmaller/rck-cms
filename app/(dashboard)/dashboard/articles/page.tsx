import Link from "next/link";

import { ArticleStatus, Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { ArticleBulkList } from "@/app/(dashboard)/dashboard/articles/_components/article-bulk-list";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
const FILTERABLE_STATUSES = [ArticleStatus.PUBLISHED, ArticleStatus.DRAFT] as const;
type FilterableStatus = (typeof FILTERABLE_STATUSES)[number];

type DashboardArticlesSearchParams = {
  page?: string;
  q?: string;
  status?: string;
  category?: string;
  createdFrom?: string;
  createdTo?: string;
  perPage?: string;
};

type DashboardArticlesPageProps = {
  searchParams: Promise<DashboardArticlesSearchParams>;
};

export default async function DashboardArticlesPage({ searchParams }: DashboardArticlesPageProps) {
  const session = await auth();
  const role = session?.user?.role ?? "AUTHOR";
  const userId = session?.user?.id ?? null;
  const isAuthor = role === "AUTHOR";

  const resolvedParams = await searchParams;
  const rawPage = Number(resolvedParams.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const query = (resolvedParams.q ?? "").trim();
  const statusParam = (resolvedParams.status ?? "").trim().toUpperCase();
  const selectedStatus = FILTERABLE_STATUSES.includes(statusParam as FilterableStatus)
    ? (statusParam as FilterableStatus)
    : null;
  const categoryParam = (resolvedParams.category ?? "").trim().toLowerCase();
  const selectedCategory = categoryParam.length > 0 ? categoryParam : null;
  const createdFromInput = (resolvedParams.createdFrom ?? "").trim();
  const createdToInput = (resolvedParams.createdTo ?? "").trim();
  const perPageRaw = Number(resolvedParams.perPage ?? PAGE_SIZE_DEFAULT);
  const pageSize = Number.isFinite(perPageRaw) && PAGE_SIZE_OPTIONS.includes(perPageRaw as PageSizeOption)
    ? (perPageRaw as PageSizeOption)
    : PAGE_SIZE_DEFAULT;

  const parseDateInput = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [yearStr, monthStr, dayStr] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const createdFromDate = createdFromInput ? parseDateInput(createdFromInput) : null;
  const createdToDate = createdToInput ? parseDateInput(createdToInput) : null;
  const createdToExclusive = createdToDate
    ? new Date(createdToDate.getTime() + 24 * 60 * 60 * 1000)
    : null;

  const filters: Prisma.ArticleWhereInput[] = [];
  if (isAuthor) {
    filters.push({ authorId: userId ?? "__unknown__" });
  }
  if (query) {
    filters.push({
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
        {
          author: {
            OR: [
              { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
            ],
          },
        },
      ],
    });
  }
  if (selectedStatus) {
    filters.push({ status: selectedStatus });
  }
  if (selectedCategory) {
    filters.push({
      categories: {
        some: {
          category: { slug: selectedCategory },
        },
      },
    });
  }
  if (createdFromDate || createdToExclusive) {
    filters.push({
      createdAt: {
        ...(createdFromDate ? { gte: createdFromDate } : {}),
        ...(createdToExclusive ? { lt: createdToExclusive } : {}),
      },
    });
  }

  const where = filters.length > 0 ? { AND: filters } : undefined;

  const [totalArticles, categories] = await Promise.all([
    prisma.article.count({ where }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalArticles / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const articles = await prisma.article.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      author: { select: { id: true, name: true, email: true } },
      categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
      tags: { include: { tag: true } },
    },
  });

  const articlePaths = articles.map((article) => `/articles/${article.slug}`);
  const viewsByPath = new Map<string, number>();
  if (articlePaths.length > 0) {
    try {
      const uniqueArticleVisits = await prisma.visitLog.findMany({
        where: { path: { in: articlePaths } },
        select: { path: true, ip: true },
        distinct: ["path", "ip"],
      });
      for (const entry of uniqueArticleVisits) {
        const current = viewsByPath.get(entry.path) ?? 0;
        viewsByPath.set(entry.path, current + 1);
      }
    } catch {
      // keep views at zero if logging table not available
    }
  }

  const articleItems = articles.map((article) => {
    const categoryNames = article.categories
      .map((entry) => entry.category?.name)
      .filter(Boolean) as string[];
    const viewCount = viewsByPath.get(`/articles/${article.slug}`) ?? 0;
    return {
      id: article.id,
      title: article.title,
      status: article.status,
      authorName: article.author?.name ?? null,
      publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
      categories: categoryNames,
      viewCount,
      publicUrl: `/articles/${article.slug}`,
      editUrl: `/dashboard/articles/${article.id}/edit`,
    };
  });

  const startItem = totalArticles === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = totalArticles === 0 ? 0 : startItem + articles.length - 1;

  const buildPageLink = (pageNumber: number) => {
    const params = new URLSearchParams();
    const targetPage = Math.min(Math.max(pageNumber, 1), totalPages);
    if (query) params.set("q", query);
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedCategory) params.set("category", selectedCategory);
    if (createdFromInput) params.set("createdFrom", createdFromInput);
    if (createdToInput) params.set("createdTo", createdToInput);
    if (pageSize !== PAGE_SIZE_DEFAULT) params.set("perPage", String(pageSize));
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/dashboard/articles${qs ? `?${qs}` : ""}`;
  };

  const primaryBtn =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const paginationButtonClass = buttonVariants({ variant: "outline", size: "sm" });
  const statusLabelMap: Record<FilterableStatus, string> = {
    [ArticleStatus.PUBLISHED]: "Dipublikasikan",
    [ArticleStatus.DRAFT]: "Draf",
  };
  const statusOptions: Array<{ value: FilterableStatus; label: string }> =
    FILTERABLE_STATUSES.map((value) => ({
      value,
      label: statusLabelMap[value],
    }));
  const hasFilters =
    query ||
    selectedStatus ||
    selectedCategory ||
    createdFromInput ||
    createdToInput ||
    pageSize !== PAGE_SIZE_DEFAULT;

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Artikel"
        description="Kelola artikel, status publikasi, dan media unggulan."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <form
          method="get"
          action="/dashboard/articles"
          className="flex w-full flex-col gap-3"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Input
              name="q"
              defaultValue={query}
              placeholder="Cari judul, kategori, tag, atau penulis..."
              className="lg:max-w-sm"
            />
            <div className="flex items-center gap-2">
              {hasFilters ? (
                <Link
                  href="/dashboard/articles"
                  className={cn(paginationButtonClass, "whitespace-nowrap")}
                >
                  Reset
                </Link>
              ) : null}
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                Cari
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-1">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={selectedStatus ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Semua status</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="category">Kategori</Label>
              <select
                id="category"
                name="category"
                defaultValue={selectedCategory ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Semua kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="perPage">Artikel per halaman</Label>
              <select
                id="perPage"
                name="perPage"
                defaultValue={pageSize}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} artikel
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="createdFrom">Dibuat dari</Label>
              <Input
                id="createdFrom"
                name="createdFrom"
                type="date"
                defaultValue={createdFromDate ? createdFromInput : ""}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="createdTo">Dibuat sampai</Label>
              <Input
                id="createdTo"
                name="createdTo"
                type="date"
                defaultValue={createdToDate ? createdToInput : ""}
              />
            </div>
          </div>
        </form>
        <Link className={primaryBtn} href="/dashboard/articles/new">
          + Artikel Baru
        </Link>
      </div>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Artikel</CardTitle>
            <CardDescription>
              {totalArticles === 0
                ? "Belum ada artikel."
                : `Menampilkan ${startItem}-${endItem} dari ${totalArticles} artikel.`}
              {query ? ` Pencarian: “${query}”.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ArticleBulkList
              articles={articleItems}
              isAuthor={isAuthor}
              hasFilters={Boolean(hasFilters)}
            />
          </CardContent>
        </Card>
      </section>

      {totalArticles > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {safePage} dari {totalPages}. Menampilkan {startItem}-{endItem}.
          </p>
          <div className="flex items-center gap-2">
            {safePage > 1 ? (
              <Link className={paginationButtonClass} href={buildPageLink(safePage - 1)}>
                Sebelumnya
              </Link>
            ) : (
              <span className={cn(paginationButtonClass, "pointer-events-none opacity-50")}>
                Sebelumnya
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Halaman {safePage} / {totalPages}
            </span>
            {safePage < totalPages ? (
              <Link className={paginationButtonClass} href={buildPageLink(safePage + 1)}>
                Berikutnya
              </Link>
            ) : (
              <span className={cn(paginationButtonClass, "pointer-events-none opacity-50")}>
                Berikutnya
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
