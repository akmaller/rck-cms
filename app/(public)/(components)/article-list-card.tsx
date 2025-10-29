import Image from "next/image";
import Link from "next/link";

import { formatRelativeTime } from "@/lib/datetime/relative";

type ArticleListCardProps = {
  href: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: Date | string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  category?: {
    name: string;
    slug: string;
  } | null;
  image?: {
    url: string;
    alt?: string | null;
  } | null;
};

function formatDateLabel(date: Date | string | null | undefined) {
  const label = formatRelativeTime(date);
  return label || "-";
}

export function ArticleListCard({
  href,
  title,
  excerpt,
  publishedAt,
  authorName,
  authorAvatarUrl,
  category,
  image,
}: ArticleListCardProps) {
  const thumbnail = image?.url ?? null;
  const alt = image?.alt?.trim() || title;
  const authorLabel = authorName?.trim() || "Anonim";
  const authorInitial = authorLabel.charAt(0).toUpperCase();

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:border-primary/60 hover:bg-primary/5">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5">
        {thumbnail ? (
          <Link
            href={href}
            className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-32 sm:w-48"
          >
            <Image
              src={thumbnail}
              alt={alt}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(min-width: 768px) 192px, 100vw"
            />
            <span className="sr-only">Baca {title}</span>
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              {category ? (
                <Link
                  href={`/categories/${category.slug}`}
                  className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {category.name}
                </Link>
              ) : null}
              <span>{formatDateLabel(publishedAt)}</span>
            </div>
            <Link
              href={href}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground transition group-hover:text-primary">
                {title}
              </h3>
            </Link>
            <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt ?? "Belum ada ringkasan."}</p>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              {authorAvatarUrl ? (
                <Image
                  src={authorAvatarUrl}
                  alt={`Foto ${authorLabel}`}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                  sizes="24px"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground/70">
                  {authorInitial}
                </span>
              )}
              <span className="font-medium text-foreground">{authorLabel}</span>
            </span>
            <Link
              href={href}
              className="inline-flex items-center gap-1 font-medium text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Baca selengkapnya
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
