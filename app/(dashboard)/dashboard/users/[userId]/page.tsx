import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { UserEditForm } from "./user-edit-form";

type UserEditPageProps = {
  params: { userId: string };
};

export default async function UserEditPage({ params }: UserEditPageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;

  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang memiliki akses ke halaman ini." />
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/dashboard/users");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/users">Kembali ke Daftar</Link>
        </Button>
        <Card className="border-border/60">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium">Informasi Cepat</CardTitle>
            <CardDescription className="text-xs">
              ID: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{user.id}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="py-2 text-xs text-muted-foreground">
            Akun dibuat {new Date(user.createdAt).toLocaleString("id-ID")}
          </CardContent>
        </Card>
      </div>

      <DashboardHeading
        heading={`Edit Pengguna: ${user.name}`}
        description="Perbarui informasi profil pengguna atau hapus akun bila diperlukan."
      />

      <UserEditForm
        userId={user.id}
        initialName={user.name}
        initialEmail={user.email}
        initialRole={user.role}
        createdAt={user.createdAt.toISOString()}
      />
    </div>
  );
}
