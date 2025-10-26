import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return createMetadata({
    config,
    title: "Kategori Artikel",
    description: `Telusuri kumpulan kategori artikel yang dikurasi ${config.name}.`,
    path: "/categories",
  });
}

export default async function CategoriesIndexPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = "/categories";
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Kategori</h1>
        <p className="text-muted-foreground">
          Temukan tema tulisan yang kami kurasi untuk pembaca kami.
        </p>
      </header>

      {categories.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Kategori belum tersedia</CardTitle>
            <CardDescription>
              Konten akan segera hadir. Sementara, jelajahi artikel terbaru kami.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants({ variant: "outline" })} href="/articles">
              Lihat Artikel
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="rounded-lg border border-border/70 bg-card p-4 transition hover:border-primary/60 hover:bg-primary/5"
            >
              <p className="text-sm font-semibold text-foreground">{category.name}</p>
              <p className="text-xs text-muted-foreground">
                {category._count.articles.toLocaleString("id-ID")} artikel
              </p>
              {category.description ? (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {category.description}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
