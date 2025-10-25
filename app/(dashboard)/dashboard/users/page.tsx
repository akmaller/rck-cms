import { auth } from "@/auth";
import { UserForm } from "@/components/forms/user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";

import { UserList } from "./user-list";

export default async function UsersPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized
        description="Halaman ini hanya tersedia untuk Administrator."
      />
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  const userEntries = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Pengguna"
        description="Kelola akun pengguna dan perannya di CMS."
      />
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Pengguna</CardTitle>
            <CardDescription>Total {userEntries.length} pengguna terdaftar.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserList users={userEntries} currentUserId={session.user.id} />
          </CardContent>
        </Card>
        <UserForm />
      </section>
    </div>
  );
}
