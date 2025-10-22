import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PageForm } from "@/components/forms/page-form";
import { updatePage } from "@/components/forms/actions";
import { buttonVariants } from "@/lib/button-variants";

export default async function EditPage({ params }: { params: { pageId: string } }) {
  const [page, media] = await Promise.all([
    prisma.page.findUnique({
      where: { id: params.pageId },
    }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  if (!page) {
    notFound();
  }

  const mediaItems = media.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt.toISOString(),
  }));

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
        submitLabel="Perbarui Halaman"
        onSubmit={async (formData) => {
          formData.set("pageId", page.id);
          return updatePage(formData);
        }}
        redirectTo="/dashboard/pages"
      />
    </div>
  );
}
