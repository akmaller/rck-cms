import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";

import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = {
  title: "Verifikasi 2FA",
  description: "Masukkan kode autentikasi dua faktor untuk melanjutkan.",
};

type TwoFactorPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const tokenParam = typeof params.token === "string" ? params.token : undefined;
  const redirectTo = typeof params.redirectTo === "string" ? params.redirectTo : undefined;

  if (!tokenParam) {
    redirect("/login");
  }

  const pending = await prisma.twoFactorToken.findUnique({ where: { token: tokenParam } });
  if (!pending || pending.purpose !== "LOGIN" || pending.expiresAt < new Date()) {
    if (pending) {
      await prisma.twoFactorToken.delete({ where: { id: pending.id } }).catch(() => {});
    }
    redirect("/login?error=twoFactorExpired");
  }

  const user = await prisma.user.findUnique({ where: { id: pending.userId }, select: { email: true } });
  const config = await getSiteConfig();

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 md:flex-row">
        <section className="flex-1 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            &larr; Kembali ke {config.name}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Verifikasi Dua Faktor</h1>
          <p className="max-w-md text-muted-foreground">
            Kami telah memverifikasi email dan password Anda. Masukkan kode 6 digit dari aplikasi
            autentikator untuk menyelesaikan proses masuk.
          </p>
          <p className="text-sm text-muted-foreground">
            Jika Anda tidak lagi memiliki akses ke aplikasi autentikator, hubungi administrator untuk
            reset 2FA.
          </p>
        </section>
        <section className="flex-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Masukkan Kode 2FA</CardTitle>
              <CardDescription>Gunakan kode yang dihasilkan aplikasi autentikator Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <TwoFactorForm token={tokenParam} redirectTo={redirectTo} email={user?.email ?? undefined} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
