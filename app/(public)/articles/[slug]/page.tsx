import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArticleStatus } from "@prisma/client";

import Image from "next/image";
import { auth } from "@/auth";
import { ArticleViewer } from "@/components/article/article-viewer";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { getArticleComments } from "@/lib/comments/service";
import { prisma } from "@/lib/prisma";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";
import { getSiteConfig } from "@/lib/site-config/server";
import { ArticleSidebar } from "@/app/(public)/(components)/article-sidebar";
import { getArticleSidebarData } from "@/lib/articles/sidebar";
import { ShareActions } from "@/app/(public)/(components)/share-actions";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";

async function getArticle(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true } },
      categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
      tags: { include: { tag: true } },
      featuredMedia: { select: { url: true, title: true, description: true, width: true, height: true } },
    },
  });
}

export async function generateStaticParams() {
  const articles = await prisma.article.findMany({
    where: { status: ArticleStatus.PUBLISHED },
    select: { slug: true },
  });

  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    return createMetadata({
      title: "Artikel tidak ditemukan",
      description: "Konten yang Anda cari tidak tersedia.",
      path: `/articles/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  const categories = article.categories.map((entry) => entry.category.name);
  const tags = article.tags.map((entry) => entry.tag.name);
  const keywords = [...categories, ...tags, article.title];

  return createMetadata({
    title: article.title,
    description: article.excerpt ?? undefined,
    keywords,
    path: `/articles/${slug}`,
    type: "article",
    image: article.featuredMedia
      ? {
          url: article.featuredMedia.url,
          alt: article.featuredMedia.description ?? article.featuredMedia.title ?? article.title,
          width: article.featuredMedia.width ?? undefined,
          height: article.featuredMedia.height ?? undefined,
        }
      : null,
    tags: [...new Set([...categories, ...tags])],
    authors: article.author?.name ? [article.author.name] : undefined,
    publishedTime: article.publishedAt ?? article.createdAt,
    modifiedTime: article.updatedAt,
  });
}

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArticleDetailPage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    notFound();
  }

  const categories = article.categories.map((item) => item.category);
  const tags = article.tags.map((item) => item.tag);
  const commentsPromise = getArticleComments(article.id);
  const sessionPromise = auth();
  const siteConfigPromise = getSiteConfig();

  const { latestSidebarArticles, popularSidebarArticles, popularTags, relatedSidebarArticles } =
    await getArticleSidebarData({
      excludeSlug: slug,
      relatedCategoryIds: categories.map((category) => category.id),
    });

  const [comments, session, siteConfig] = await Promise.all([
    commentsPromise,
    sessionPromise,
    siteConfigPromise,
  ]);
  const commentsEnabled = siteConfig?.comments?.enabled ?? true;
  const commentCount = comments.length;

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = `/articles/${slug}`;
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({
    path,
    url,
    referrer,
    ip,
    userAgent,
  });

  const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formatDateLabel = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const value = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return "-";
    return dateFormatter.format(value);
  };

  const sessionUserName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Pengguna Terdaftar";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="flex flex-col gap-10">
          <header className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {categories.length ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.15em]">
                      {categories.map((category) => (
                        <Link
                          key={category.id}
                          href={`/categories/${category.slug}`}
                          className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                    <span aria-hidden>•</span>
                  </>
                ) : null}
                <span>{formatDateLabel(article.publishedAt)}</span>
                {article.author ? (
                  <>
                    <span aria-hidden>•</span>
                    <span>
                      oleh{" "}
                      <Link
                        href={`/authors/${article.author.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {article.author.name}
                      </Link>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          <div className="space-y-6">
            {article.featuredMedia?.url ? (
              <div className="relative overflow-hidden rounded-xl border border-border/60">
                <Image
                  src={article.featuredMedia.url}
                  alt={article.featuredMedia.description ?? article.featuredMedia.title ?? article.title}
                  width={article.featuredMedia.width ?? 1280}
                  height={article.featuredMedia.height ?? 720}
                  className="h-auto w-full object-cover"
                  style={{ width: "100%", height: "auto" }}
                  priority
                />
                {article.featuredMedia?.description ? (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-xs font-medium leading-snug text-white sm:px-6 sm:text-sm">
                    {article.featuredMedia.description}
                  </div>
                ) : null}
              </div>
            ) : null}
            <ArticleViewer content={article.content} />
          </div>

          <footer className="space-y-6">
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <Card>
              <CardContent className="py-4">
                <ShareActions
                  title={article.title}
                  articleUrl={`${process.env.NEXT_PUBLIC_APP_URL}/articles/${article.slug}`}
                />
              </CardContent>
            </Card>
          </footer>

          <section id="artikel-komentar" className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                Komentar ({commentCount})
              </h2>
              <p className="text-sm text-muted-foreground">
                Kami meninjau komentar untuk menjaga percakapan tetap sehat. Hindari membagikan informasi sensitif.
              </p>
            </div>

            {commentsEnabled ? (
              session?.user ? (
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <CommentForm articleId={article.id} slug={article.slug} userName={sessionUserName} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col gap-4 pt-6">
                    <p className="text-sm text-muted-foreground">
                      Masuk atau daftar untuk bergabung dalam diskusi. Kami melindungi akun Anda dengan keamanan berlapis.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link className={buttonVariants({ variant: "default" })} href={`/login?redirectTo=/articles/${article.slug}#artikel-komentar`}>
                        Masuk
                      </Link>
                      <Link className={buttonVariants({ variant: "outline" })} href={`/register?redirectTo=/articles/${article.slug}#artikel-komentar`}>
                        Daftar
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Modul komentar sedang dinonaktifkan oleh administrator. Anda masih dapat membaca komentar yang sudah ada.
                  </p>
                </CardContent>
              </Card>
            )}

            {(commentsEnabled || comments.length > 0) ? (
              <CommentList comments={comments} currentUserId={session?.user?.id ?? null} />
            ) : null}
          </section>
        </article>

        <ArticleSidebar
          latestArticles={latestSidebarArticles}
          popularArticles={popularSidebarArticles}
          popularTags={popularTags}
          relatedArticles={relatedSidebarArticles}
        />
      </div>
    </div>
  );
}
