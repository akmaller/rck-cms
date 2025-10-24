import { auth } from "@/auth";
import { ConfigForm, ConfigValues } from "@/components/forms/config-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CacheControls } from "./_components/cache-controls";
import { BackupControls } from "./_components/backup-controls";

export default async function SettingsIndexPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Halaman pengaturan hanya dapat diakses oleh Administrator." />
    );
  }

  const configRecord = await prisma.siteConfig.findUnique({ where: { key: "general" } });
  const value = (configRecord?.value ?? {}) as ConfigValues;

  const initialConfig: ConfigValues = {
    siteName: value.siteName ?? "",
    siteUrl: value.siteUrl ?? "",
    logoUrl: value.logoUrl ?? "",
    iconUrl: value.iconUrl ?? "",
    tagline: value.tagline ?? "",
    timezone: value.timezone ?? "UTC",
    contactEmail: value.contactEmail ?? "",
    cacheEnabled: value.cache?.enabled ?? true,
    social: {
      facebook: value.social?.facebook ?? "",
      instagram: value.social?.instagram ?? "",
      youtube: value.social?.youtube ?? "",
      twitter: value.social?.twitter ?? "",
    },
    metadata: {
      title: value.metadata?.title ?? "",
      description: value.metadata?.description ?? "",
      keywords: value.metadata?.keywords ?? [],
    },
  };

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Informasi Umum"
        description="Sesuaikan identitas, metadata, dan kontak utama situs."
      />
      <ConfigForm initialConfig={initialConfig} />
      <CacheControls />
      <BackupControls />
      <Card>
        <CardHeader>
          <CardTitle>Panduan</CardTitle>
          <CardDescription>Ikuti rekomendasi berikut agar tampilan konsisten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Gunakan logo berformat SVG/PNG transparan untuk hasil terbaik.</p>
          <p>• Pastikan metadata title dan description singkat serta jelas.</p>
          <p>• Tambahkan kata kunci maksimal 10 item, dipisahkan koma.</p>
        </CardContent>
      </Card>
    </div>
  );
}
