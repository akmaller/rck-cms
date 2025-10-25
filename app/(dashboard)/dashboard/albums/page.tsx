import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ArticleStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { deriveThumbnailUrl } from "@/lib/storage/media";
import { cn } from "@/lib/utils";

function formatStatus(status: ArticleStatus) {
  switch (status) {
    case ArticleStatus.PUBLISHED:
      return { label: "Publik", variant: "default" as const };
    case ArticleStatus.REVIEW:
      return { label: "Review", variant: "secondary" as const };
    case ArticleStatus.SCHEDULED:
      return { label: "Terjadwal", variant: "secondary" as const };
    case ArticleStatus.ARCHIVED:
      return { label: "Arsip", variant: "outline" as const };
    case ArticleStatus.DRAFT:
    default:
      return { label: "Draft", variant: "outline" as const };
  }
}

export default async function DashboardAlbumsPage() {
  const session = await auth();
  const role = session?.user?.role ?? null;
  if (!session?.user) {
    redirect("/login");
  }
  if (role !== "ADMIN" && role !== "EDITOR") {
    redirect("/dashboard");
  }

  const albums = await prisma.album.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      images: {
        orderBy: { position: "asc" },
        include: {
          media: { select: { url: true } },
        },
        take: 1,
      },
      _count: { select: { images: true } },
    },
  });

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Album Gambar"
        description="Kelola kumpulan gambar untuk dokumentasi kegiatan dan publikasi."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {albums.length === 0
            ? "Belum ada album yang dibuat."
            : `Total ${albums.length} album tersimpan.`}
        </p>
        <Link
          href="/dashboard/albums/new"
          className={cn(
            buttonVariants({ size: "sm" }),
            "inline-flex items-center justify-center gap-2 whitespace-nowrap"
          )}
        >
          + Album Baru
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Album</CardTitle>
          <CardDescription>
            {albums.length === 0
              ? "Album belum dibuat. Mulai dengan menambahkan album baru."
              : "Klik album untuk melihat detail atau mengelola konten."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {albums.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              <p>Album belum dibuat. Mulai dengan membuat album baru.</p>
              <Link
                href="/dashboard/albums/new"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Buat Album
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {albums.map((album) => {
                const previewMedia = album.images[0]?.media ?? null;
                const previewUrl = previewMedia
                  ? deriveThumbnailUrl(previewMedia.url) ?? previewMedia.url
                  : null;
                const statusMeta = formatStatus(album.status);
                const createdAt = new Date(album.createdAt);
                const publishedAt = album.publishedAt ? new Date(album.publishedAt) : null;
                return (
                  <Link
                    key={album.id}
                    href={`/dashboard/albums/${album.id}/edit`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="relative h-40 w-full overflow-hidden border-b border-border/60 bg-muted">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt={album.title}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          Tidak ada pratinjau
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="line-clamp-2 text-base font-semibold text-foreground">
                            {album.title}
                          </h3>
                          {album.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {album.description}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </div>
                      <div className="mt-auto space-y-1 text-xs text-muted-foreground">
                        <p>
                          Dibuat: {createdAt.toLocaleDateString("id-ID")} •{" "}
                          {album.createdBy?.name ?? "Tidak diketahui"}
                        </p>
                        {publishedAt ? (
                          <p>Publikasi: {publishedAt.toLocaleDateString("id-ID")}</p>
                        ) : (
                          <p>Belum dipublikasikan</p>
                        )}
                        <p>{album._count.images} gambar</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
