import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ArrowLeft } from "lucide-react";

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
    <AuthLayout
      hero={
        <>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              Lupa password? Kami bantu pulihkan akses akun Anda.
            </h1>
          </div>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
              <span>Tautan reset berlaku selama 30 menit sejak permintaan dibuat.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
              <span>Selesai reset, semua perangkat akan diminta masuk ulang.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
              <span>Hubungi admin jika Anda tidak lagi memiliki akses ke email terdaftar.</span>
            </li>
          </ul>
          <div className="relative mx-auto mt-6 max-w-xs">
            <div className="absolute inset-0 rounded-full bg-sky-200/40 blur-2xl" aria-hidden />
            <Image
              src="/images/auth-illustration.svg"
              alt="Ilustrasi lupa password"
              width={360}
              height={310}
              loading="lazy"
              className="relative mx-auto drop-shadow-xl"
            />
          </div>
        </>
      }
    >
      <div className="space-y-6">
        <Card className="border-0 shadow-xl shadow-sky-100/70 ring-1 ring-slate-200/70">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle asChild>
                <h2 className="text-2xl font-semibold text-slate-900">Permintaan Reset Password</h2>
              </CardTitle>
              <Link
                href="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label={`Kembali ke ${config.name}`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <CardDescription>Masukkan email dan kami akan mengirim instruksi reset password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />
            <p className="text-center text-sm text-slate-600">
              Ingat password Anda?{" "}
              <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700">
                Masuk di sini
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
