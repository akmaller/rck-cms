import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard/dashboard-shell";
import { auth } from "@/auth";
import type { RoleKey } from "@/lib/auth/permissions";
import { getSiteConfig } from "@/lib/site-config/server";
import { prisma } from "@/lib/prisma";
import { createMetadata } from "@/lib/seo/metadata";

type DashboardUser = {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return createMetadata({
    config,
    title: `${config.name} Dashboard`,
    description: `Area administrasi untuk pengelolaan konten ${config.name}.`,
    path: "/dashboard",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        nocache: true,
        noimageindex: true,
        nosnippet: true,
      },
    },
  });
}

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
