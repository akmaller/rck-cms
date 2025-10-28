import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ArrowLeft } from "lucide-react";

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
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

  if (params?.next) {
    redirect(params.next as string);
  }

  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const config = await getSiteConfig();
  const hero = (
    <>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          Permudah interaksi antar{" "}
          <span className="text-sky-700">Kreator</span> dan{" "}
          <span className="text-orange-500">Pembaca</span> !
        </h1>
        <p className="text-base text-slate-600">
          Publikasikan ide tanpa batas dan jaga kolaborasi tim tetap produktif.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-slate-600">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
          <span>Kelola konten, komentar, dan media {config.name} secara real-time.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
          <span>Analitik performa untuk memantau pertumbuhan komunitas Anda.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
          <span>Perlindungan keamanan berlapis dengan audit log dan 2FA.</span>
        </li>
      </ul>
      <div className="relative mx-auto mt-4 max-w-xs">
        <div className="absolute inset-0 rounded-full bg-sky-200/40 blur-2xl" aria-hidden />
        <Image
          src="/images/auth-illustration.svg"
          alt="Ilustrasi kolaborasi kreator"
          width={360}
          height={310}
          priority
          className="relative mx-auto drop-shadow-xl"
        />
      </div>
    </>
  );

  return (
    <AuthLayout hero={hero}>
      <div className="space-y-6">
        <Card className="border-0 shadow-xl shadow-sky-100/70 ring-1 ring-slate-200/70">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle asChild>
                <h2 className="text-2xl font-semibold text-slate-900">Hai, selamat datang kembali</h2>
              </CardTitle>
              <Link
                href="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label={`Kembali ke ${config.name}`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <CardDescription>
              Masuk untuk melanjutkan pengelolaan konten dan komunitas {config.name}.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Memuat formulir...</div>}>
              <LoginForm callbackUrl={callbackUrl} turnstileSiteKey={turnstileSiteKey} />
            </Suspense>
            <div className="text-right text-sm">
              <Link href="/forgot-password" className="font-medium text-sky-600 hover:text-sky-700">
                Lupa kata sandi?
              </Link>
            </div>
            <p className="text-center text-sm text-slate-600">
              Baru di {config.name}?{" "}
              <Link href="/register" className="font-semibold text-sky-600 hover:text-sky-700">
                Daftar gratis
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
