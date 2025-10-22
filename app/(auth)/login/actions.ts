"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";

const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(1, { message: "Password wajib diisi" }),
  twoFactorCode: z.string().optional(),
  redirectTo: z.string().optional(),
});

type LoginState = {
  error?: string;
};

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    twoFactorCode: formData.get("twoFactorCode") || undefined,
    redirectTo: formData.get("redirectTo") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Form tidak valid" };
  }

  const { email, password, twoFactorCode, redirectTo } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      twoFactorCode,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: error.cause?.message ?? "Kredensial salah" };
      }

      return { error: "Autentikasi gagal. Silakan coba lagi." };
    }

    return { error: "Terjadi kesalahan tak terduga" };
  }

  redirect(redirectTo ?? "/dashboard");
}
