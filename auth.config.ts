import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import { verifyTwoFactorToken } from "@/lib/auth/totp";
import { isRateLimited, resetRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

type DerivedDeviceInfo = {
  userAgent: string;
  browser?: string;
  os?: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
};

function deriveDeviceInfo(userAgentHeader: string | null | undefined): DerivedDeviceInfo {
  if (!userAgentHeader) {
    return { userAgent: "unknown", deviceType: "unknown" };
  }

  const userAgent = userAgentHeader.trim();
  if (!userAgent) {
    return { userAgent: "unknown", deviceType: "unknown" };
  }

  const uaLower = userAgent.toLowerCase();

  let deviceType: DerivedDeviceInfo["deviceType"] = "desktop";
  if (/bot|crawl|spider|slurp|mediapartners/i.test(userAgent)) {
    deviceType = "bot";
  } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|android/i.test(userAgent)) {
    deviceType = "mobile";
  }

  const browserDetectors: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /edg\/([\d.]+)/i, name: "Edge" },
    { pattern: /chrome\/([\d.]+)/i, name: "Chrome" },
    { pattern: /safari\/([\d.]+)/i, name: "Safari" },
    { pattern: /firefox\/([\d.]+)/i, name: "Firefox" },
    { pattern: /opr\/([\d.]+)/i, name: "Opera" },
    { pattern: /msie\s([\d.]+)/i, name: "IE" },
    { pattern: /trident\/.*rv:([\d.]+)/i, name: "IE" },
  ];

  const browserMatch = browserDetectors.find(({ pattern }) => pattern.test(userAgent));
  const browser = browserMatch ? browserMatch.name : undefined;

  let os: string | undefined;
  if (/windows nt 10/i.test(userAgent)) os = "Windows 10";
  else if (/windows nt 11/i.test(userAgent)) os = "Windows 11";
  else if (/windows nt 6\.3/i.test(userAgent)) os = "Windows 8.1";
  else if (/windows nt 6\.2/i.test(userAgent)) os = "Windows 8";
  else if (/windows nt 6\.1/i.test(userAgent)) os = "Windows 7";
  else if (/mac os x 10[_\.]15/i.test(userAgent)) os = "macOS Catalina";
  else if (/mac os x 10[_\.]14/i.test(userAgent)) os = "macOS Mojave";
  else if (/mac os x/i.test(userAgent)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/linux/i.test(uaLower)) os = "Linux";
  else if (/cros/i.test(userAgent)) os = "Chrome OS";

  return {
    userAgent,
    browser,
    os,
    deviceType,
  };
}

const credentialsSchema = z
  .object({
    email: z.string().email({ message: "Email tidak valid" }).optional(),
    password: z.string().min(1, { message: "Password wajib diisi" }).optional(),
    twoFactorCode: z.string().optional(),
    twoFactorToken: z.string().optional(),
  })
  .refine((data) => {
    if (data.twoFactorToken) {
      return Boolean(data.twoFactorCode);
    }
    return Boolean(data.email && data.password);
  }, { message: "Kredensial tidak valid" });

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

        const { email, password, twoFactorCode, twoFactorToken } = parsed.data;
        const forwardedFor = request?.headers?.get("x-forwarded-for") ?? "";
        const ipFromHeader = forwardedFor.split(",")[0]?.trim();
        const ip = ipFromHeader || "unknown";
        const deviceInfo = deriveDeviceInfo(request?.headers?.get("user-agent"));

        if (twoFactorToken) {
          const pendingToken = await prisma.twoFactorToken.findUnique({
            where: { token: twoFactorToken },
          });
          const pendingPurpose = (pendingToken as { purpose?: string } | null)?.purpose;

          if (!pendingToken || pendingPurpose !== "LOGIN") {
            throw new Error("Sesi 2FA kedaluwarsa. Silakan masuk kembali.");
          }

          if (pendingToken.expiresAt < new Date()) {
            await prisma.twoFactorToken.delete({ where: { id: pendingToken.id } });
            throw new Error("Sesi 2FA kedaluwarsa. Silakan masuk kembali.");
          }

          const user = await prisma.user.findUnique({ where: { id: pendingToken.userId } });
          if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            await prisma.twoFactorToken.delete({ where: { id: pendingToken.id } });
            throw new Error("2FA tidak tersedia untuk akun ini.");
          }

          if (!twoFactorCode) {
            throw new Error("Kode 2FA diperlukan");
          }

          const isValid2FA = verifyTwoFactorToken(twoFactorCode, user.twoFactorSecret);
          if (!isValid2FA) {
            throw new Error("Kode 2FA tidak valid");
          }

          await prisma.$transaction([
            prisma.twoFactorToken.delete({ where: { id: pendingToken.id } }),
            prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            }),
          ]);

          const rateLimitKeyTwoFactor = `login:${ip}:${user.email ?? "unknown"}`;
          resetRateLimit(rateLimitKeyTwoFactor);

          await writeAuditLog({
            action: "USER_LOGIN",
            entity: "User",
            entityId: user.id,
            userId: user.id,
            metadata: {
              ip,
              device: deviceInfo,
              loginMethod: "CREDENTIALS_WITH_2FA",
              email: user.email,
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        const emailForPassword = email!;
        const passwordForCheck = password!;
        const rateLimitKey = `login:${ip}:${emailForPassword}`;

        if (isRateLimited(rateLimitKey, 5, 60_000)) {
          throw new Error("Terlalu banyak percobaan login. Coba lagi setelah 1 menit.");
        }

        const user = await prisma.user.findUnique({ where: { email: emailForPassword } });

        if (!user || !user.passwordHash) {
          throw new Error("Email atau password salah");
        }

        const isValidPassword = await verifyPassword(passwordForCheck, user.passwordHash);
        if (!isValidPassword) {
          throw new Error("Email atau password salah");
        }

        if (user.twoFactorEnabled) {
          throw new Error("Kode 2FA diperlukan");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        resetRateLimit(rateLimitKey);

        await writeAuditLog({
          action: "USER_LOGIN",
          entity: "User",
          entityId: user.id,
          userId: user.id,
          metadata: {
            ip,
            device: deviceInfo,
            loginMethod: "CREDENTIALS",
            email: user.email,
          },
        });

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
