import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getSiteConfig } from "@/lib/site-config/server";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Daftar Penulis",
  description: "Registrasi akun penulis Roemah Cita.",
};

export default async function RegisterPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Menjadi Penulis di Roemah Cita</h1>
          <p className="max-w-md text-muted-foreground">
            Daftar untuk membagikan cerita dan karya Anda. Setelah registrasi, kami akan mengirim tautan aktivasi ke email untuk mengaktifkan akun.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Role awal penulis adalah AUTHOR dan dapat mulai menulis setelah akun aktif.</li>
            <li>• Aktivasi akun wajib melalui email terdaftar.</li>
            <li>• Anda dapat melengkapi profil dan bio setelah masuk ke dashboard.</li>
          </ul>
        </section>
        <section className="flex-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle asChild>
                <h2>Registrasi Penulis</h2>
              </CardTitle>
              <CardDescription>Isi formulir di bawah ini untuk membuat akun penulis.</CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterForm />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Sudah punya akun? <Link href="/login" className="font-semibold text-primary hover:underline">Masuk di sini</Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
