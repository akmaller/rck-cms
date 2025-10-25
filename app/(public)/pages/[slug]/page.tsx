import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { ArticleViewer } from "@/components/article/article-viewer";
import { prisma } from "@/lib/prisma";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";

async function getPage(slug: string) {
  return prisma.page.findUnique({
    where: { slug },
    include: { featuredMedia: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || page.status !== "PUBLISHED") {
    return createMetadata({
      title: "Halaman tidak ditemukan",
      description: "Halaman yang Anda cari tidak tersedia.",
      path: `/pages/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  return createMetadata({
    title: page.title,
    description: page.excerpt ?? undefined,
    path: `/pages/${slug}`,
    type: "article",
    image: page.featuredMedia
      ? {
          url: page.featuredMedia.url,
          alt: page.featuredMedia.title ?? page.title,
          width: page.featuredMedia.width ?? undefined,
          height: page.featuredMedia.height ?? undefined,
        }
      : null,
    keywords: [page.title],
    tags: [page.title],
    publishedTime: page.publishedAt ?? page.createdAt,
    modifiedTime: page.updatedAt,
  });
}

type StaticPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StaticPage({ params }: StaticPageProps) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || page.status !== "PUBLISHED") {
    notFound();
  }

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = `/pages/${slug}`;
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  const featuredImage = page.featuredMedia?.url ?? null;
  const heroTitle = page.title;
  const heroStyle: CSSProperties = {
    minHeight: "clamp(160px, 16vh, 340px)",
  };

  return (
    <article className="flex flex-col">
      <div className="relative left-1/2 w-screen -translate-x-1/2 -mt-10">
        <div className="relative isolate flex w-full items-end overflow-hidden" style={heroStyle}>
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={page.featuredMedia?.title ?? heroTitle}
              fill
              priority
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/15 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent" />
          <div className="relative z-10 flex w-full justify-center pb-10">
            <div className="w-full max-w-4xl space-y-3 px-6 sm:px-10">
              <h1 className="text-3xl font-semibold text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
                {heroTitle}
              </h1>
              {page.excerpt ? (
                <p className="text-sm text-white/80 sm:text-base">{page.excerpt}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-0">
        <ArticleViewer content={page.content} />
      </div>
    </article>
  );
}
