import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { AlbumGallery } from "./album-gallery";

type AlbumPageProps = {
  params: Promise<{ albumId: string }>;
};

export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { albumId } = await params;
  const album = await prisma.album.findFirst({
    where: { id: albumId, status: ArticleStatus.PUBLISHED },
    select: { title: true, description: true },
  });

  if (!album) {
    return {};
  }

  const config = await getSiteConfig();
  const description =
    album.description ??
    `Lihat dokumentasi foto terbaru dari ${config.name} melalui album ${album.title}.`;

  return createMetadata({
    config,
    title: `${album.title} — Album Foto`,
    description,
    path: `/albums/${albumId}`,
  });
}

export default async function AlbumDetailPage({ params }: AlbumPageProps) {
  const { albumId } = await params;

  const album = await prisma.album.findFirst({
    where: { id: albumId, status: ArticleStatus.PUBLISHED },
    include: {
      images: {
        include: {
          media: {
            select: {
              id: true,
              url: true,
              title: true,
              width: true,
              height: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!album) {
    notFound();
  }

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-primary/70">Album Foto</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{album.title}</h1>
        </div>
        {album.description ? (
          <p className="text-lg text-muted-foreground">{album.description}</p>
        ) : null}
      </header>

      {album.images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          Album ini belum memiliki foto.
        </p>
      ) : (
        <AlbumGallery
          albumTitle={album.title}
          images={album.images.map((image, index) => ({
            id: image.id,
            url: image.media.url,
            title: image.media.title ?? `Foto ${index + 1}`,
            caption: image.caption ?? "",
            width: image.media.width ?? undefined,
            height: image.media.height ?? undefined,
          }))}
        />
      )}
    </article>
  );
}
