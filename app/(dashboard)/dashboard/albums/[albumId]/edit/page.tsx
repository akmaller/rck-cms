import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/lib/button-variants";
import { AlbumEditForm } from "../../_components/album-edit-form";

type EditAlbumPageProps = {
  params: Promise<{ albumId: string }>;
};

export default async function EditAlbumPage({ params }: EditAlbumPageProps) {
  const { albumId } = await params;

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: {
      images: {
        include: {
          media: {
            select: {
              id: true,
              title: true,
              url: true,
              size: true,
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

  const albumForForm = {
    id: album.id,
    title: album.title,
    description: album.description,
    status: album.status,
    images: album.images.map((image) => ({
      id: image.id,
      mediaId: image.mediaId,
      url: image.media.url,
      title: image.media.title,
      size: image.media.size,
      caption: image.caption ?? "",
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Album</h1>
          <p className="text-sm text-muted-foreground">
            Perbarui informasi album dan kelola kumpulan gambar.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/albums">
          Kembali ke daftar
        </Link>
      </div>
      <AlbumEditForm album={albumForForm} />
    </div>
  );
}
