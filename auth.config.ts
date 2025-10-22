                                                                            import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import { verifyTwoFactorToken } from "@/lib/auth/totp";
import { isRateLimited, resetRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(1, { message: "Password wajib diisi" }),
  twoFactorCode: z.string().optional(),
});

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers: [
    Credentials({
      authorize: async (credentials, request) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "Kredensial tidak valid");
        }

        const { email, password, twoFactorCode } = parsed.data;
        const forwardedFor = request?.headers?.get("x-forwarded-for") ?? "";
        const ipFromHeader = forwardedFor.split(",")[0]?.trim();
        const ip = ipFromHeader || "unknown";
        const rateLimitKey = `login:${ip}:${email}`;

        if (isRateLimited(rateLimitKey, 5, 60_000)) {
          throw new Error("Terlalu banyak percobaan login. Coba lagi setelah 1 menit.");
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.passwordHash) {
          throw new Error("Email atau password salah");
        }

        const isValidPassword = await verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
          throw new Error("Email atau password salah");
        }

        if (user.twoFactorEnabled) {
          if (!user.twoFactorSecret) {
            throw new Error("2FA belum dikonfigurasi dengan benar");
          }

          if (!twoFactorCode) {
            throw new Error("Kode 2FA diperlukan");
          }

          const isValidToken = verifyTwoFactorToken(twoFactorCode, user.twoFactorSecret);
          if (!isValidToken) {
            throw new Error("Kode 2FA tidak valid");
          }
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        resetRateLimit(rateLimitKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }

      return session;
    },
    authorized: async ({ request, auth }) => {
      const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
      if (!isDashboardRoute) {
        return true;
      }

      if (!auth?.user) {
        return false;
      }

      const allowedRoles = new Set(["ADMIN", "EDITOR", "AUTHOR"]);
      return allowedRoles.has((auth.user as { role?: string }).role ?? "");
    },
  },
} satisfies NextAuthConfig;
