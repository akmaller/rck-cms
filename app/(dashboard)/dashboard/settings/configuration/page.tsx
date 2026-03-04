import { auth } from "@/auth";
import { ConfigForm, type ConfigValues } from "@/components/forms/config-form";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getSocialCredentialsSafe } from "@/lib/social/accounts";

import { buildInitialConfig } from "../utils";

export const runtime = "nodejs";

export default async function ConfigurationSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengelola konfigurasi integrasi." />
    );
  }

  const configRecord = await prisma.siteConfig.findUnique({ where: { key: "general" } });
  const value = (configRecord?.value ?? {}) as ConfigValues;
  const initialConfig = buildInitialConfig(value);
  const credentials = await getSocialCredentialsSafe();
  initialConfig.socialAutopost = {
    ...(initialConfig.socialAutopost ?? {}),
    facebook: {
      ...(initialConfig.socialAutopost?.facebook ?? {}),
      pageId: credentials.facebook.pageId ?? "",
      pageAccessToken: credentials.facebook.pageAccessToken ?? "",
    },
    instagram: {
      ...(initialConfig.socialAutopost?.instagram ?? {}),
      igUserId: credentials.instagram.igUserId ?? "",
      pageAccessToken: credentials.instagram.pageAccessToken ?? "",
    },
    twitter: {
      ...(initialConfig.socialAutopost?.twitter ?? {}),
      accessToken: credentials.twitter.accessToken ?? "",
    },
  };

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Konfigurasi Integrasi"
        description="Kelola integrasi analitik dan auto-post sosial media dari satu halaman."
      />
      <ConfigForm
        initialConfig={initialConfig}
        sections={["analytics", "socialAutopost"]}
        heading="Integrasi Analitik & Sosial"
        description="Atur Google Tag Manager dan kredensial auto-post ke Facebook, Instagram, dan X."
      />
    </div>
  );
}
