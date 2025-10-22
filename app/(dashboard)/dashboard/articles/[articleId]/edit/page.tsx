import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/forms/article-form";
import { updateArticle } from "@/components/forms/actions";
import { buttonVariants } from "@/lib/button-variants";

export default async function EditArticlePage({ params }: { params: { articleId: string } }) {
  const [article, media] = await Promise.all([
    prisma.article.findUnique({
      where: { id: params.articleId },
      include: {
        featuredMedia: true,
      },
    }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  if (!article) {
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
          <h1 className="text-2xl font-semibold tracking-tight">Edit Artikel</h1>
          <p className="text-sm text-muted-foreground">Perbarui konten artikel dan gambar unggulan.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/articles">
          Kembali ke daftar
        </Link>
      </div>
      <ArticleForm
        mediaItems={mediaItems}
        initialValues={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt ?? undefined,
          content: (article.content as Record<string, unknown>) ?? undefined,
          featuredMediaId: article.featuredMediaId ?? null,
        }}
        submitLabel="Perbarui Artikel"
        onSubmit={async (formData) => {
          formData.set("articleId", article.id);
          return updateArticle(formData);
        }}
      />
    </div>
  );
}
