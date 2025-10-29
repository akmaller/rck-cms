import Link from "next/link";

import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { PageForm } from "@/components/forms/page-form";
import { buttonVariants } from "@/lib/button-variants";
import { prisma } from "@/lib/prisma";
import { getForbiddenPhrases } from "@/lib/moderation/forbidden-terms";

export default async function NewPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || !(["ADMIN", "EDITOR"] as RoleKey[]).includes(role)) {
    return (
      <DashboardUnauthorized description="Hanya Admin dan Editor yang dapat membuat halaman statis." />
    );
  }

  const [media, forbiddenPhrases] = await Promise.all([
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    getForbiddenPhrases(),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DashboardHeading
          heading="Halaman Baru"
          description="Tulis halaman statis baru dan publikasikan secara instan atau simpan sebagai draft."
        />
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/pages">
          Kembali ke Halaman
        </Link>
      </div>
      <PageForm mediaItems={mediaItems} forbiddenPhrases={forbiddenPhrases} />
    </div>
  );
}
