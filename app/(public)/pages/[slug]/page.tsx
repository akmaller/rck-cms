import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import Link from "next/link";

import { ArticleViewer } from "@/components/article/article-viewer";
import { buttonVariants } from "@/lib/button-variants";
import { prisma } from "@/lib/prisma";

async function getPage(slug: string) {
  return prisma.page.findUnique({
    where: { slug },
    include: { featuredMedia: true },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page || page.status !== "PUBLISHED") {
    return { title: "Halaman tidak ditemukan" };
  }

  return {
    title: page.title,
    description: page.excerpt ?? undefined,
  };
}

export default async function StaticPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page || page.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{page.title}</h1>
        {page.excerpt ? <p className="text-muted-foreground">{page.excerpt}</p> : null}
      </header>
      {page.featuredMedia?.url ? (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <Image
            src={page.featuredMedia.url}
            alt={page.featuredMedia.title ?? page.title}
            width={page.featuredMedia.width ?? 1280}
            height={page.featuredMedia.height ?? 720}
            className="h-auto w-full object-cover"
            priority
          />
        </div>
      ) : null}
      <ArticleViewer content={page.content} />
      <footer>
        <Link className={buttonVariants({ variant: "outline" })} href="/">
          Kembali ke beranda
        </Link>
      </footer>
    </div>
  );
}
