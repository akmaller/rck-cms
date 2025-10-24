"use server";

import { randomUUID } from "node:crypto";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(1, { message: "Password wajib diisi" }),
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
    redirectTo: toOptionalString(formData.get("redirectTo")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form tidak valid" };
  }

  const { email, password, redirectTo } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return { error: "Email atau password salah" };
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return { error: "Email atau password salah" };
  }

  if (user.twoFactorEnabled) {
    await prisma.twoFactorToken.deleteMany({
      where: { userId: user.id, purpose: "LOGIN" },
    });

    const token = randomUUID();
    await prisma.twoFactorToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        purpose: "LOGIN",
      },
    });

    const params = new URLSearchParams({ token });
    if (redirectTo) {
      params.set("redirectTo", redirectTo);
    }
    redirect(`/login/2fa?${params.toString()}`);
  }

  try {
    await signIn("credentials", {
      email,
      password,
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
