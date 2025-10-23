import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ArticleEditorShell } from "@/app/(dashboard)/dashboard/articles/_components/editor-shell";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

export default async function EditArticlePage({ params }: { params: { articleId: string } }) {
  const [article, media, tags, categories] = await Promise.all([
    prisma.article.findUnique({
      where: { id: params.articleId },
      include: {
        featuredMedia: true,
        categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!article) {
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

  if (article.featuredMedia && !mediaItems.some((item) => item.id === article.featuredMediaId)) {
    mediaItems.unshift({
      id: article.featuredMedia.id,
      title: article.featuredMedia.title,
      description: article.featuredMedia.description,
      url: article.featuredMedia.url,
      mimeType: article.featuredMedia.mimeType,
      size: article.featuredMedia.size,
      createdAt: article.featuredMedia.createdAt.toISOString(),
    });
  }

  const allTags = tags.map((tag) => tag.name);
  const allCategories = categories.map((category) => category.name);
  const initialTags = article.tags.map((entry) => entry.tag.name);
  const initialCategories = article.categories.map((entry) => entry.category.name);

  return (
    <>
      <DashboardHeading
        heading="Edit Artikel"
        description="Perbarui konten artikel dan gambar unggulan."
      />
      <ArticleEditorShell
        mediaItems={mediaItems}
        allTags={allTags}
        allCategories={allCategories}
        initialValues={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          content: (article.content as Record<string, unknown>) ?? undefined,
          featuredMediaId: article.featuredMediaId ?? null,
          tags: initialTags,
          categories: initialCategories,
        }}
        submitLabel="Perbarui Artikel"
      />
    </>
  );
}
