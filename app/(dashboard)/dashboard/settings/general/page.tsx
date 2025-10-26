import { auth } from "@/auth";
import { ConfigForm, ConfigValues } from "@/components/forms/config-form";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { buildInitialConfig } from "../utils";

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

  const initialConfig = buildInitialConfig(value);

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Identitas & Branding"
        description="Kelola nama, tagline, logo, dan tautan sosial resmi Roemah Cita."
      />
      <ConfigForm
        initialConfig={initialConfig}
        sections={["branding", "social"]}
        heading="Identitas Situs"
        description="Perbarui nama, logo, dan tautan resmi yang ditampilkan ke publik."
      />
    </div>
  );
}
