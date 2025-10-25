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
    title: "Tag Populer",
    description: `Daftar tag populer untuk menjelajahi topik di ${config.name}.`,
    path: "/tags",
  });
}

export default async function TagsIndexPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = "/tags";
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Tag</h1>
        <p className="text-muted-foreground">
          Jelajahi topik populer yang sering dibicarakan.
        </p>
      </header>

      {tags.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada tag</CardTitle>
            <CardDescription>
              Konten segera hadir. Lihat artikel terbaru sementara menunggu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants({ variant: "outline" })} href="/articles">
              Artikel Terbaru
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-6">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                #{tag.name}
                <span className="text-muted-foreground"> ({tag._count.articles})</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
