import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Atur Ulang Password",
  description: "Masukkan password baru untuk akun Anda.",
};

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : undefined;

  const config = await getSiteConfig();

  if (!token) {
    return (
      <div className="min-h-screen bg-muted/40 py-12">
        <div className="mx-auto w-full max-w-lg px-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle asChild>
                <h2>Tautan Tidak Valid</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Token reset password tidak ditemukan atau tautan tidak lengkap. Minta ulang tautan reset password untuk
                melanjutkan proses.
              </p>
              <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
                Minta tautan reset password baru
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 md:flex-row">
        <section className="flex-1 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            &larr; Kembali ke {config.name}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Buat Password Baru</h1>
          <p className="max-w-md text-muted-foreground">
            Masukkan password baru agar akses akun {config.name} tetap aman. Setelah password diperbarui, Anda akan
            diminta untuk masuk kembali pada semua perangkat.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Gunakan kombinasi huruf, angka, dan simbol untuk keamanan maksimal.</li>
            <li>• Jangan bagikan tautan reset password kepada siapa pun.</li>
            <li>• Proses reset akan membatalkan semua sesi login yang masih aktif.</li>
          </ul>
        </section>
        <section className="flex-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle asChild>
                <h2>Reset Password</h2>
              </CardTitle>
              <CardDescription>Isi password baru Anda di bawah ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm token={token} />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Ingat password Anda?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Masuk ke dashboard
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
