import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

import { TwoFactorManager } from "./two-factor-manager";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Keamanan Akun"
        description="Atur autentikasi dua faktor dan pantau aktivitas akun Anda."
      />

      <Card>
        <CardHeader>
          <CardTitle>Autentikasi Dua Faktor (2FA)</CardTitle>
          <CardDescription>
            Gunakan aplikasi autentikator (Google Authenticator, Authy, dll.) untuk menambahkan lapisan keamanan tambahan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorManager email={user.email ?? ""} twoFactorEnabled={user.twoFactorEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
