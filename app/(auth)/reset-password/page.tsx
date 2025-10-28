import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ArrowLeft } from "lucide-react";

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
    const hero = (
      <>
        <span className="inline-flex items-center rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-600 shadow-sm ring-1 ring-white/70">
          Keamanan {config.name}
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
            Tautan reset tidak valid atau sudah kedaluwarsa.
          </h1>
          <p className="text-base text-slate-600">
            Demi keamanan, setiap tautan reset password hanya berlaku sekali pakai. Minta tautan baru dan segera
            selesaikan proses reset sebelum waktunya habis.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
            <span>Pastikan Anda menggunakan tautan terbaru dari email resmi {config.name}.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
            <span>Laporkan ke tim kami bila Anda merasa tidak meminta reset password.</span>
          </li>
        </ul>
        <div className="relative mx-auto mt-6 max-w-xs">
          <div className="absolute inset-0 rounded-full bg-sky-200/40 blur-2xl" aria-hidden />
          <Image
            src="/images/auth-illustration.svg"
            alt="Ilustrasi keamanan akun"
            width={360}
            height={310}
            loading="lazy"
            className="relative mx-auto drop-shadow-xl"
          />
        </div>
      </>
    );

    return (
      <AuthLayout hero={hero}>
        <Card className="border-0 shadow-xl shadow-sky-100/70 ring-1 ring-slate-200/70">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle asChild>
                <h2 className="text-2xl font-semibold text-slate-900">Tautan tidak valid</h2>
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
              Token reset password tidak ditemukan atau tautan sudah tidak berlaku.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Minta ulang tautan reset password melalui email dan pastikan Anda membuka tautan terbaru yang kami
              kirimkan.
            </p>
            <Link href="/forgot-password" className="font-semibold text-sky-600 hover:text-sky-700">
              Minta tautan reset password baru
            </Link>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  const hero = (
    <>
      <span className="inline-flex items-center rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-600 shadow-sm ring-1 ring-white/70">
        Keamanan {config.name}
      </span>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          Perbarui password Anda dengan langkah sederhana dan aman.
        </h1>
        <p className="text-base text-slate-600">
          Gunakan kombinasi karakter kuat untuk menjaga akun {config.name} tetap terlindungi. Setelah berhasil, kami
          akan menutup sesi pada perangkat lain secara otomatis.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-slate-600">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
          <span>Pastikan password minimal 8 karakter dengan campuran huruf, angka, dan simbol.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
          <span>Jangan bagikan tautan reset kepada siapa pun untuk mencegah penyalahgunaan.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden />
          <span>Selesai memperbarui? Masuk kembali dan lanjutkan berkarya.</span>
        </li>
      </ul>
      <div className="relative mx-auto mt-4 max-w-xs">
        <div className="absolute inset-0 rounded-full bg-sky-200/40 blur-2xl" aria-hidden />
        <Image
          src="/images/auth-illustration.svg"
          alt="Ilustrasi reset password"
          width={360}
          height={310}
          loading="lazy"
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
                <h2 className="text-2xl font-semibold text-slate-900">Reset Password</h2>
              </CardTitle>
              <Link
                href="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label={`Kembali ke ${config.name}`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <CardDescription>Isi password baru Anda di bawah ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ResetPasswordForm token={token} />
            <p className="text-center text-sm text-slate-600">
              Ingat password Anda?{" "}
              <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700">
                Masuk ke dashboard
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
