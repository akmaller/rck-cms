import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard/dashboard-shell";
import { auth } from "@/auth";
import type { RoleKey } from "@/lib/auth/permissions";
import { getSiteConfig } from "@/lib/site-config/server";
import { prisma } from "@/lib/prisma";

type DashboardUser = {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  const siteConfig = await getSiteConfig();

  const userRecord = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { theme: true, name: true, email: true, avatarUrl: true },
      })
    : null;

  const userTheme = userRecord?.theme ?? "LIGHT";

  const currentUser: DashboardUser = {
    id: session?.user?.id ?? "anonymous",
    name: userRecord?.name ?? session?.user?.name ?? "Pengguna",
    email: userRecord?.email ?? session?.user?.email ?? null,
    avatarUrl: userRecord?.avatarUrl ?? null,
  };

  return (
    <DashboardShell
      currentRole={role}
      siteConfig={siteConfig}
      initialTheme={userTheme}
      currentUser={currentUser}
    >
      {children}
    </DashboardShell>
  );
}
