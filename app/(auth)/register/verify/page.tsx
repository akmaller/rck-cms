import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activateUserByToken } from "../actions";

export const metadata = {
  title: "Aktivasi Akun",
};

type VerifyPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = params.token;

  let message = "Token aktivasi tidak ditemukan.";
  let success = false;

  if (token) {
    const result = await activateUserByToken(token);
    if (result.success) {
      success = true;
      message = result.success;
    } else if (result.error) {
      message = result.error;
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto w-full max-w-2xl px-4">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Aktivasi Akun</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              href={success ? "/login" : "/register"}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {success ? "Masuk ke dashboard" : "Kembali ke halaman registrasi"}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
