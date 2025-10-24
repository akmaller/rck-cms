import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import { buttonVariants } from "@/lib/button-variants";
import type { RoleKey } from "@/lib/auth/permissions";

import { PageList } from "./_components/page-list";

export default async function DashboardPages() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || !(["ADMIN", "EDITOR"] as RoleKey[]).includes(role)) {
    return (
      <DashboardUnauthorized description="Hanya Admin dan Editor yang dapat mengelola halaman statis." />
    );
  }

  const pages = await prisma.page.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DashboardHeading
          heading="Halaman Statis"
          description="Kelola konten statis seperti Tentang, Kontak, dan landing page lainnya."
        />
        <Link className={buttonVariants()} href="/dashboard/pages/new">
          Tambah Halaman
        </Link>
      </div>
      <PageList
        pages={pages.map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          updatedAt: page.updatedAt.toISOString(),
          createdAt: page.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
