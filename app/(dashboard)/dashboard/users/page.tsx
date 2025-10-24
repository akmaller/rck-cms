import Link from "next/link";

import { auth } from "@/auth";
import { UserForm } from "@/components/forms/user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

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
            <CardDescription>Total {users.length} pengguna terdaftar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.email} • {user.role}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("id-ID")}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/users/${user.id}`}>Edit</Link>
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
            ) : null}
          </CardContent>
        </Card>
        <UserForm />
      </section>
    </div>
  );
}
