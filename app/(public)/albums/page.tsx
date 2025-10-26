import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArticleStatus } from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { deriveThumbnailUrl } from "@/lib/storage/media";

export const metadata: Metadata = {
  title: "Album Dokumentasi",
  description: "Kumpulan album foto kegiatan dan program terbaru dari komunitas kami.",
};

export default async function AlbumsPage() {
  const albums = await prisma.album.findMany({
    where: { status: ArticleStatus.PUBLISHED },
    include: {
      images: {
        include: {
          media: {
            select: {
              url: true,
              title: true,
            },
          },
        },
        orderBy: { position: "asc" },
        take: 1,
      },
      _count: { select: { images: true } },
    },
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Album Dokumentasi</h1>
        <p className="text-muted-foreground">
          Telusuri dokumentasi foto kegiatan dan program terbaru.
        </p>
      </div>
      {albums.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardHeader>
            <CardTitle>Tidak ada album</CardTitle>
            <CardDescription>
              Kami belum mempublikasikan album foto. Kembali lagi nanti untuk melihat pembaruan.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const cover = album.images[0]?.media ?? null;
            const previewUrl = cover ? deriveThumbnailUrl(cover.url) ?? cover.url : null;
            return (
              <Card key={album.id} className="flex h-full flex-col overflow-hidden">
                {previewUrl ? (
                  <div className="relative h-48 w-full overflow-hidden border-b border-border/60">
                    <Image
                      src={previewUrl}
                      alt={cover?.title ?? album.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                ) : (
                  <div className="flex h-48 w-full items-center justify-center border-b border-border/60 bg-muted text-sm text-muted-foreground">
                    Tidak ada pratinjau
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-2">{album.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {album.description ?? "Album dokumentasi kegiatan terbaru."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span>{album._count.images} foto</span>
                  <Link
                    href={`/albums/${album.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Lihat Album
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
