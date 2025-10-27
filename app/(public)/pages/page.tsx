import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArticleStatus } from "@prisma/client";

import { buttonVariants } from "@/lib/button-variants";
import { formatRelativeTime } from "@/lib/datetime/relative";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return createMetadata({
    config,
    title: "Halaman Informasi",
    description: `Kumpulan halaman informasi penting dari ${config.name}.`,
    path: "/pages",
  });
}

export default async function StaticPagesIndex() {
  const pages = await prisma.page.findMany({
    where: { status: ArticleStatus.PUBLISHED },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      updatedAt: true,
    },
  });

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = "/pages";
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Halaman Informasi</h1>
        <p className="text-muted-foreground">
          Ringkasan halaman statis yang menampilkan informasi penting dari kami.
        </p>
      </header>

      {pages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada halaman</CardTitle>
            <CardDescription>
              Konten akan segera hadir. Tetap pantau informasi terbaru dari kami.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map((page) => {
            const updatedLabel = formatRelativeTime(page.updatedAt);
            return (
              <Card key={page.id} className="border-border/70">
                <CardHeader>
                  <CardTitle>{page.title}</CardTitle>
                  <CardDescription>
                    {updatedLabel ? `Diperbarui ${updatedLabel}` : ""}
                  </CardDescription>
                </CardHeader>
                {page.excerpt ? (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{page.excerpt}</p>
                  </CardContent>
                ) : null}
                <CardContent>
                  <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/pages/${page.slug}`}>
                    Baca Halaman
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
