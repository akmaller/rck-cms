import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";

import { BackupControls } from "../_components/backup-controls";

export const runtime = "nodejs";

export default async function MaintenanceSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengelola backup dan impor data." />
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Backup & Pemulihan"
        description="Ekspor atau impor data penting untuk menjaga kelangsungan sistem."
      />
      <BackupControls />
    </div>
  );
}
