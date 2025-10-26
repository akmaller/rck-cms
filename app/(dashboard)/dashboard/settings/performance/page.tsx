import { auth } from "@/auth";
import { ConfigForm, type ConfigValues } from "@/components/forms/config-form";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

import { CacheControls } from "../_components/cache-controls";
import { buildInitialConfig } from "../utils";

export const runtime = "nodejs";

export default async function PerformanceSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengubah pengaturan performa." />
    );
  }

  const configRecord = await prisma.siteConfig.findUnique({ where: { key: "general" } });
  const value = (configRecord?.value ?? {}) as ConfigValues;
  const initialConfig = buildInitialConfig(value);

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Performa & Cache"
        description="Kelola strategi cache untuk halaman publik dan lakukan pembersihan manual bila dibutuhkan."
      />
      <ConfigForm
        initialConfig={initialConfig}
        sections={["cache"]}
        heading="Pengaturan Cache"
        description="Aktifkan atau nonaktifkan cache halaman publik sesuai kebutuhan operasional."
      />
      <CacheControls />
    </div>
  );
}
