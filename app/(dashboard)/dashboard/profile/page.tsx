import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getForbiddenPhrases } from "@/lib/moderation/forbidden-terms";

import { PasswordUpdateForm } from "./password-form";
import { ProfileInfoForm } from "./profile-info-form";
import { TwoFactorManager } from "../settings/security/two-factor-manager";
import { AvatarUploader } from "./avatar-uploader";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [user, forbiddenPhrases] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        role: true,
        avatarUrl: true,
        twoFactorEnabled: true,
        socialLinks: true,
      },
    }),
    getForbiddenPhrases(),
  ]);

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Profil Saya"
        description="Kelola informasi akun, perbarui password, dan amankan akses dengan 2FA."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <ProfileInfoForm
          initialData={{
            name: user.name,
            email: user.email,
            bio: user.bio ?? null,
            socialLinks: (user.socialLinks as Record<string, string | null> | null) ?? {},
          }}
          forbiddenPhrases={forbiddenPhrases}
        />
        <div className="space-y-6">
          <AvatarUploader initialAvatarUrl={user.avatarUrl} userName={user.name} />
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Akun</CardTitle>
              <CardDescription>Detail singkat mengenai akun Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Nama: </span>
                {user.name}
              </p>
              <p>
                <span className="font-medium text-foreground">Email: </span>
                {user.email}
              </p>
              <p>
                <span className="font-medium text-foreground">Peran: </span>
                {user.role}
              </p>
              <p>
                <span className="font-medium text-foreground">Status 2FA: </span>
                {user.twoFactorEnabled ? "Aktif" : "Belum aktif"}
              </p>
            </CardContent>
          </Card>
          <PasswordUpdateForm />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Autentikasi Dua Faktor (2FA)</CardTitle>
          <CardDescription>
            Tambahkan lapisan keamanan ekstra dengan aplikasi autentikator pilihan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorManager email={user.email} twoFactorEnabled={user.twoFactorEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
