import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { CategoryForm } from "@/components/forms/category-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { CategoryList } from "@/components/taxonomies/category-list";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";

export default async function TaxonomiesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || !(["ADMIN", "EDITOR"] as RoleKey[]).includes(role)) {
    return (
      <DashboardUnauthorized description="Hanya Admin dan Editor yang dapat mengatur kategori dan tag." />
    );
  }

  const categories = await prisma.category.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Kategori"
        description="Atur struktur kategori untuk membantu navigasi dan SEO."
      />
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Kategori</CardTitle>
            <CardDescription>
              Total {categories.length} kategori. Hubungkan artikel dengan kategori untuk memudahkan klasifikasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryList
              items={categories.map((category) => ({
                id: category.id,
                name: category.name,
                slug: category.slug,
                description: category.description,
                articleCount: category._count.articles,
                createdAt: category.createdAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
        <CategoryForm />
      </section>
    </div>
  );
}
