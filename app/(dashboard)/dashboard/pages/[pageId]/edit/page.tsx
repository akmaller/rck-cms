import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PageForm } from "@/components/forms/page-form";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeletePageButton } from "../../_components/delete-page-button";
import { getForbiddenPhrases } from "@/lib/moderation/forbidden-terms";

type EditPageProps = {
  params: Promise<{ pageId: string }>;
};

export default async function EditPage({ params }: EditPageProps) {
  const { pageId } = await params;
  const [page, media, forbiddenPhrases] = await Promise.all([
    prisma.page.findUnique({
      where: { id: pageId },
      include: { featuredMedia: true },
    }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    getForbiddenPhrases(),
  ]);

  if (!page) {
    notFound();
  }

  const mediaItems = media.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt.toISOString(),
  }));

  if (page.featuredMedia && !mediaItems.some((item) => item.id === page.featuredMediaId)) {
    mediaItems.unshift({
      id: page.featuredMedia.id,
      title: page.featuredMedia.title,
      description: page.featuredMedia.description,
      url: page.featuredMedia.url,
      mimeType: page.featuredMedia.mimeType,
      size: page.featuredMedia.size,
      createdAt: page.featuredMedia.createdAt.toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Halaman</h1>
          <p className="text-sm text-muted-foreground">Perbarui konten dan media unggulan halaman.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/pages">
          Kembali ke daftar
        </Link>
      </div>
      <PageForm
        mediaItems={mediaItems}
        initialValues={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          excerpt: page.excerpt ?? undefined,
          content: (page.content as Record<string, unknown>) ?? undefined,
          featuredMediaId: page.featuredMediaId ?? null,
        }}
        submitLabel="Simpan Draft"
        publishLabel="Publikasikan"
        redirectTo="/dashboard/pages"
        forbiddenPhrases={forbiddenPhrases}
      />
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Hapus Halaman</CardTitle>
          <CardDescription>
            Menghapus halaman akan menghilangkan konten dari situs publik. Tindakan ini tidak dapat
            dibatalkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Pastikan Anda sudah membuat cadangan jika diperlukan sebelum menghapus.
          </p>
          <DeletePageButton pageId={page.id} pageTitle={page.title} redirectTo="/dashboard/pages" />
        </CardContent>
      </Card>
    </div>
  );
}
