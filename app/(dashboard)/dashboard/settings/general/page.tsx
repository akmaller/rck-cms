import { auth } from "@/auth";
import { ConfigForm, ConfigValues } from "@/components/forms/config-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CacheControls } from "../_components/cache-controls";
import { BackupControls } from "../_components/backup-controls";

export const runtime = "nodejs";

export default async function GeneralSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengubah informasi umum." />
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
    cache: {
      enabled: value.cache?.enabled ?? true,
    },
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
    registration: {
      enabled: value.registration?.enabled ?? true,
      autoApprove: value.registration?.autoApprove ?? false,
    },
  };

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Informasi Umum"
        description="Kelola identitas, metadata, dan utilitas sistem publik."
      />
      <ConfigForm initialConfig={initialConfig} />
      <CacheControls />
      <BackupControls />
      <Card>
        <CardHeader>
          <CardTitle>Panduan</CardTitle>
          <CardDescription>Tips singkat untuk menjaga konsistensi brand.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Pastikan logo menggunakan format SVG atau PNG transparan.</p>
          <p>• Keywords dipisahkan koma dan maksimal 10 kata kunci.</p>
          <p>• Metadata title/description digunakan sebagai fallback SEO.</p>
        </CardContent>
      </Card>
    </div>
  );
}
