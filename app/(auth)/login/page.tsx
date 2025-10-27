import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";

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

  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const config = await getSiteConfig();

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 md:flex-row">
        <section className="flex-1 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            &larr; Kembali ke {config.name}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Masuk dan Mulai Berkarya</h1>
          <p className="max-w-md text-muted-foreground">
            Gunakan akun Anda untuk mengakses dashboard penulis dan kelola seluruh konten dengan aman.<br></br>
Jika fitur keamanan 2FA aktif, sistem akan meminta kode OTP setelah Anda berhasil masuk.
          </p>
        </section>
        <section className="flex-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle asChild>
                <h2>Masuk ke Dashboard</h2>
              </CardTitle>
              <CardDescription>Masukkan email dan password yang telah terdaftar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="text-sm text-muted-foreground">Memuat formulir...</div>}>
                <LoginForm callbackUrl={callbackUrl} />
              </Suspense>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Lupa password?{" "}
                <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
                  Reset di sini
                </Link>
              </p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Belum punya akun?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Daftar sebagai penulis
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
