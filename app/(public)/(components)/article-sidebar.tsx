import Image from "next/image";
import Link from "next/link";

import type { SidebarArticle } from "@/lib/articles/sidebar";
import { deriveThumbnailUrl } from "@/lib/storage/media";
import { formatRelativeTime } from "@/lib/datetime/relative";

type PopularTag = {
  id: string;
  name: string;
  slug: string;
  _count: {
    articles: number;
  };
};

type ArticleSidebarProps = {
  latestArticles: SidebarArticle[];
  popularArticles: { article: SidebarArticle }[];
  popularTags: PopularTag[];
  relatedArticles?: SidebarArticle[];
};

function formatDateLabel(date: Date | string | null | undefined) {
  const label = formatRelativeTime(date);
  return label || "-";
}

function getPrimaryCategory(entry: { categories: { category: { name: string } }[] }) {
  return entry.categories[0]?.category.name ?? "Umum";
}

function getThumbnailUrl(entry: { featuredMedia?: { url: string | null } | null }) {
  const source = entry.featuredMedia?.url ?? null;
  if (!source) return null;
  return deriveThumbnailUrl(source) ?? source;
}

export function ArticleSidebar({
  latestArticles,
  popularArticles,
  popularTags,
  relatedArticles = [],
}: ArticleSidebarProps) {
  return (
    <aside className="space-y-6">
      {relatedArticles.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
            <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Artikel Terkait
              </p>
              <h2 className="text-lg font-semibold leading-tight text-foreground">Baca Juga</h2>
            </div>
          </div>
          <div className="space-y-2.5 px-3.5 py-3 sm:px-5 sm:py-3.5">
            {relatedArticles.map((item) => {
              const thumbnail = getThumbnailUrl(item);
              const fallbackInitial = item.title.trim().charAt(0).toUpperCase() || "R";
              return (
                <Link
                  key={item.id}
                  href={`/articles/${item.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-primary/60 hover:bg-primary/5"
                >
                  {thumbnail ? (
                    <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                      <Image
                        src={thumbnail}
                        alt={item.featuredMedia?.title ?? item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="112px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-primary/10 text-xl font-semibold text-primary">
                      {fallbackInitial}
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">
                      {item.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{getPrimaryCategory(item)}</span>
                      <span aria-hidden>•</span>
                      <span>{formatDateLabel(item.publishedAt)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-2.5 text-primary-foreground sm:px-5 sm:py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em]">Sorotan Terbaru</p>
          <h2 className="text-lg font-semibold">Artikel Pilihan Hari Ini</h2>
        </div>
        <div className="space-y-2.5 px-3.5 py-3 sm:px-5 sm:py-3.5">
          {latestArticles.length > 0 ? (
            latestArticles.map((item) => {
              const thumbnail = getThumbnailUrl(item);
              const fallbackInitial = item.title.trim().charAt(0).toUpperCase() || "R";
              return (
                <Link
                  key={item.id}
                  href={`/articles/${item.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-primary/60 hover:bg-primary/5"
                >
                  {thumbnail ? (
                    <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                      <Image
                        src={thumbnail}
                        alt={item.featuredMedia?.title ?? item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="112px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-primary/10 text-xl font-semibold text-primary">
                      {fallbackInitial}
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateLabel(item.publishedAt)}</p>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Belum ada artikel lain yang tersedia saat ini.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
          <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold leading-tight">Populer Minggu Ini</h2>
            <p className="text-xs text-muted-foreground">
              Berdasarkan kunjungan unik 7 hari terakhir.
            </p>
          </div>
        </div>
        {popularArticles.length > 0 ? (
          <ol className="divide-y divide-border/60">
            {popularArticles.map(({ article }, index) => (
              <li key={article.id} className="flex gap-3 px-5 py-4">
                <span className="min-w-[2.5rem] text-2xl font-bold leading-none text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/articles/${article.slug}`}
                    className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition hover:text-primary"
                  >
                    {article.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{getPrimaryCategory(article)}</span>
                    <span aria-hidden>•</span>
                    <span>{formatDateLabel(article.publishedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Data kunjungan belum tersedia. Silakan kembali lagi nanti.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
          <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold leading-tight">Topik Pilihan</h2>
            <p className="text-xs text-muted-foreground">Hashtag populer untuk eksplorasi cepat.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {popularTags.length > 0 ? (
            popularTags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
              >
                #{tag.name}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {tag._count.articles.toLocaleString("id-ID")}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada tag populer.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
