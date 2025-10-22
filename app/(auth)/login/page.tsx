import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke dashboard Roemah Cita CMS.",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = typeof params?.callbackUrl === "string" ? params.callbackUrl : undefined;

  if (params?.next) {
    redirect(params.next as string);
  }

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 md:flex-row">
        <section className="flex-1 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            &larr; Kembali ke {siteConfig.name}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Kelola konten Anda</h1>
          <p className="max-w-md text-muted-foreground">
            Gunakan kredensial ADMIN, EDITOR, atau AUTHOR untuk masuk. Jika 2FA diaktifkan, masukkan kode OTP dari aplikasi autentikator Anda.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• ADMIN: akses penuh ke konfigurasi, pengguna, dan audit</li>
            <li>• EDITOR: kelola artikel tim, media, dan penjadwalan</li>
            <li>• AUTHOR: publikasi dan kelola artikel milik sendiri</li>
          </ul>
        </section>
        <section className="flex-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Masuk ke Dashboard</CardTitle>
              <CardDescription>Masukkan email dan password yang telah terdaftar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="text-sm text-muted-foreground">Memuat formulir...</div>}>
                <LoginForm callbackUrl={callbackUrl} />
              </Suspense>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
