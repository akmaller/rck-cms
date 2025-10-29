import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { listForbiddenTerms } from "@/lib/moderation/forbidden-terms";
import { ModerationManager } from "./moderation-manager";

export const runtime = "nodejs";

export default async function ModerationSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengelola daftar kata terlarang." />
    );
  }

  const terms = await listForbiddenTerms();
  const serializedTerms = terms.map((term) => ({
    id: term.id,
    phrase: term.phrase,
    createdAt: term.createdAt.toISOString(),
    createdByName: term.createdBy?.name ?? null,
  }));

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Moderasi Konten"
        description="Kelola daftar kata atau kalimat yang akan diblokir dari konten pengguna."
      />
      <ModerationManager initialTerms={serializedTerms} />
    </div>
  );
}
