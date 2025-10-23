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
  const toStringOrEmpty = (value: FormDataEntryValue | null) =>
    typeof value === "string" ? value : "";
  const toOptionalString = (value: FormDataEntryValue | null) =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;

  const parsed = loginSchema.safeParse({
    email: toStringOrEmpty(formData.get("email")),
    password: toStringOrEmpty(formData.get("password")),
    twoFactorCode: toOptionalString(formData.get("twoFactorCode")),
    redirectTo: toOptionalString(formData.get("redirectTo")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form tidak valid" };
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
        const causeMessage =
          typeof error.cause === "object" && error.cause && "message" in error.cause
            ? (typeof (error.cause as { message?: unknown }).message === "string"
                ? (error.cause as { message: string }).message
                : "")
            : "";
        return { error: causeMessage || "Kredensial salah" };
      }

      return { error: "Autentikasi gagal. Silakan coba lagi." };
    }

    return { error: "Terjadi kesalahan tak terduga" };
  }

  redirect(redirectTo ?? "/dashboard");
}
