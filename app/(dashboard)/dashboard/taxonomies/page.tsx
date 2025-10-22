import { prisma } from "@/lib/prisma";

import { CategoryForm } from "@/components/forms/category-form";
import { TagForm } from "@/components/forms/tag-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TaxonomiesPage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { articles: true } } },
    }),
    prisma.tag.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { articles: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Kategori & Tag</h1>
          <p className="text-sm text-muted-foreground">
            Atur struktur kategori dan tag untuk membantu navigasi dan SEO.
          </p>
          <Card>
            <CardHeader>
              <CardTitle>Kategori</CardTitle>
              <CardDescription>
                Total {categories.length} kategori. Hubungkan artikel dengan kategori untuk memudahkan klasifikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      slug: {category.slug} • {category._count.articles} artikel
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(category.createdAt).toLocaleDateString("id-ID")}
                  </span>
                </div>
              ))}
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada kategori.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        <CategoryForm />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Tag</CardTitle>
              <CardDescription>Total {tags.length} tag aktif.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{tag.name}</p>
                    <p className="text-xs text-muted-foreground">
                      slug: {tag.slug} • {tag._count.articles} artikel
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(tag.createdAt).toLocaleDateString("id-ID")}
                  </span>
                </div>
              ))}
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada tag.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        <TagForm />
      </section>
    </div>
  );
}
