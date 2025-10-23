import { auth } from "@/auth";
import { ConfigForm, ConfigValues } from "@/components/forms/config-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

export default async function GeneralSettingsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
    return null;
  }

  const configRecord = await prisma.siteConfig.findUnique({ where: { key: "general" } });
  const value = (configRecord?.value ?? {}) as ConfigValues;

  const initialConfig: ConfigValues = {
    siteName: value.siteName ?? "",
    logoUrl: value.logoUrl ?? "",
    tagline: value.tagline ?? "",
    contactEmail: value.contactEmail ?? "",
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
        description="Sesuaikan identitas dan metadata situs sebelum dipublikasikan."
      />
      <ConfigForm initialConfig={initialConfig} />
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
