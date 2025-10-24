import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { MediaManager } from "@/components/media/media-manager";
import { deriveThumbnailUrl } from "@/lib/storage/media";

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user) {
    return <DashboardUnauthorized />;
  }

  const role = (session.user.role ?? "AUTHOR") as RoleKey;
  if (!(["ADMIN", "EDITOR"] as RoleKey[]).includes(role)) {
    return (
      <DashboardUnauthorized description="Hanya Admin dan Editor yang dapat mengelola media." />
    );
  }

  const media = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
  });

  const mediaItems = media.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    thumbnailUrl: deriveThumbnailUrl(item.url) ?? undefined,
    mimeType: item.mimeType,
    size: item.size,
    width: item.width,
    height: item.height,
    createdAt: item.createdAt.toISOString(),
    fileName: item.fileName,
  }));

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Media"
        description="Kelola file unggahan yang digunakan dalam artikel, halaman, atau galeri."
      />
      <MediaManager initialItems={mediaItems} />
    </div>
  );
}
