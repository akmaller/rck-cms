import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import { prisma } from "@/lib/prisma";

import { WordpressImportPanel } from "./_components/wordpress-import-panel";

export const runtime = "nodejs";

export default async function WordpressImportPage() {
  const session = await auth();
  const role = session?.user?.role ?? "AUTHOR";
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengakses modul impor WordPress." />
    );
  }

  const authors = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "EDITOR", "AUTHOR"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Import WordPress"
        description="Klon artikel dari situs WordPress eksternal, lengkap dengan kategori, tag, dan gambar unggulan."
      />
      <WordpressImportPanel
        authors={authors}
        defaultAuthorId={session.user.id}
      />
    </div>
  );
}
