import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ArticleEditorShell } from "@/app/(dashboard)/dashboard/articles/_components/editor-shell";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

export default async function NewArticlePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [media, tags, categories] = await Promise.all([
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const mediaItems = media.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt.toISOString(),
  }));
  const allTags = tags.map((tag) => tag.name);
  const allCategories = categories.map((category) => category.name);

  return (
    <>
      <DashboardHeading
        heading="Artikel Baru"
        description="Tulis artikel baru dan simpan sebagai draft sebelum dipublikasikan."
      />
      <ArticleEditorShell
        mediaItems={mediaItems}
        allTags={allTags}
        allCategories={allCategories}
        currentRole={(session.user.role ?? "AUTHOR") as "ADMIN" | "EDITOR" | "AUTHOR"}
        draftLabel="Simpan Draft"
        publishLabel="Publikasikan"
      />
    </>
  );
}
