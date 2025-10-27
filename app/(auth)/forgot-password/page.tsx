import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa Password",
  description: "Minta tautan reset password untuk akun Anda.",
};

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const config = await getSiteConfig();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 md:flex-row">
        <section className="flex-1 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            &larr; Kembali ke {config.name}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Reset Password Akun</h1>
          <p className="max-w-md text-muted-foreground">
            Masukkan email yang terdaftar pada akun {config.name}. Jika email valid, kami akan mengirim tautan reset password.
            Demi keamanan, permintaan reset dibatasi maksimal dua kali dalam lima menit.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Tautan reset hanya berlaku 30 menit setelah permintaan dibuat.</li>
            <li>• Sesi yang aktif akan otomatis keluar setelah password diperbarui.</li>
            <li>• Hubungi administrator jika tidak lagi memiliki akses email terdaftar.</li>
          </ul>
        </section>
        <section className="flex-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle asChild>
                <h2>Permintaan Reset Password</h2>
              </CardTitle>
              <CardDescription>Ketuk tombol di bawah untuk menerima tautan reset via email.</CardDescription>
            </CardHeader>
            <CardContent>
              <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Ingat password Anda?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Masuk di sini
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
