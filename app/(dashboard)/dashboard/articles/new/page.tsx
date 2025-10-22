import Link from "next/link";

import { buttonVariants } from "@/lib/button-variants";

import { ArticleForm } from "@/components/forms/article-form";
import { prisma } from "@/lib/prisma";

export default async function NewArticlePage() {
  const mediaPromise = prisma.media.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const mediaItemsPromise = mediaPromise.then((items) =>
    items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      mimeType: item.mimeType,
      size: item.size,
      createdAt: item.createdAt.toISOString(),
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Artikel Baru</h1>
          <p className="text-sm text-muted-foreground">
            Tulis artikel baru dan simpan sebagai draft sebelum dipublikasikan.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/articles">
          Kembali ke daftar
        </Link>
      </div>
      <ArticleForm mediaItems={await mediaItemsPromise} />
    </div>
  );
}
