import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleStatus } from "@prisma/client";

import Image from "next/image";
import { ArticleViewer } from "@/components/article/article-viewer";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

async function getArticle(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true } },
      categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
      tags: { include: { tag: true } },
      featuredMedia: { select: { url: true, title: true, width: true, height: true } },
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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    return {
      title: "Artikel tidak ditemukan",
    };
  }

  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      type: "article",
    },
  };
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    notFound();
  }

  const categories = article.categories.map((item) => item.category);
  const tags = article.tags.map((item) => item.tag);

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <header className="space-y-4">
        <Link href="/articles" className="text-sm text-muted-foreground">
          ← Semua artikel
        </Link>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-primary/80">
            {categories.map((category) => category.name).join(" • ") || "Artikel"}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{article.title}</h1>
          {article.excerpt ? (
            <p className="text-lg text-muted-foreground">{article.excerpt}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Dipublikasikan {article.publishedAt?.toLocaleDateString("id-ID") ?? "-"}
            {article.author ? ` • oleh ${article.author.name}` : ""}
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {article.featuredMedia?.url ? (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <Image
              src={article.featuredMedia.url}
              alt={article.featuredMedia.title ?? article.title}
              width={article.featuredMedia.width ?? 1280}
              height={article.featuredMedia.height ?? 720}
              className="h-auto w-full object-cover"
              priority
            />
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
          <CardHeader>
            <CardTitle>Bagikan Artikel</CardTitle>
            <CardDescription>Menginspirasi orang lain dengan membagikan tautan ini.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/articles/${article.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter/X
            </Link>
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/articles/${article.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </Link>
          </CardContent>
        </Card>
      </footer>
    </article>
  );
}
