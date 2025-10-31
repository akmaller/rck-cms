import { auth } from "@/auth";
import { ConfigForm, type ConfigValues } from "@/components/forms/config-form";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

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

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Konfigurasi Integrasi"
        description="Kelola integrasi analitik seperti Google Tag Manager untuk memantau traffic."
      />
      <ConfigForm
        initialConfig={initialConfig}
        sections={["analytics"]}
        heading="Integrasi Google Tag Manager"
        description="Tentukan ID container GTM yang digunakan pada seluruh halaman publik."
      />
    </div>
  );
}
