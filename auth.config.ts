import type { Prisma, User } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import { verifyTwoFactorToken } from "@/lib/auth/totp";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { deriveDeviceInfo } from "@/lib/device-info";
import { getSecurityPolicy } from "@/lib/security/policy";
import { getSiteConfig } from "@/lib/site-config/server";
import { clearRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";
import { extractClientIp, isIpBlocked } from "@/lib/security/ip-block";
import { logSecurityIncident } from "@/lib/security/activity-log";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

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

function toAdapterUser(user: User | null): (AdapterUser & { avatarUrl: string | null }) | null {
  if (!user) {
    return null;
  }

  const { avatarUrl, ...rest } = user;
  return {
    ...rest,
    image: avatarUrl,
    avatarUrl,
  } as AdapterUser & { avatarUrl: string | null };
}

const baseAdapter = PrismaAdapter(prisma);

const prismaAdapter: Adapter = {
  ...baseAdapter,
  createUser: async (adapterData) => {
    const data = adapterData as AdapterUser & { role?: string | null };
    const email = data.email;
    if (!email) {
      throw new Error("Email is required for user creation");
    }

    const roleValue =
      data.role && Object.values(UserRole).includes(data.role as UserRole)
        ? (data.role as UserRole)
        : UserRole.AUTHOR;

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name ?? email,
        avatarUrl: data.image ?? null,
        emailVerified: data.emailVerified ?? new Date(),
        role: roleValue,
      },
    });

    return toAdapterUser(user)!;
  },
  getUser: async (id) =>
    toAdapterUser(
      await prisma.user.findUnique({
        where: { id },
      })
    ),
  getUserByEmail: async (email) =>
    toAdapterUser(
      await prisma.user.findUnique({
        where: { email },
      })
    ),
  getUserByAccount: async (provider_providerAccountId) => {
    const account = await prisma.account.findUnique({
      where: provider_providerAccountId,
      include: { user: true },
    });
    return toAdapterUser(account?.user ?? null);
  },
  updateUser: async (adapterData) => {
    const data = adapterData as AdapterUser & { role?: string | null };
    if (!data.id) {
      throw new Error("User ID is required for update");
    }

    const updates: Prisma.UserUpdateInput = {
      name: data.name ?? undefined,
      email: data.email ?? undefined,
      emailVerified: data.emailVerified ?? undefined,
      avatarUrl: data.image ?? undefined,
    };

    if (data.role && Object.values(UserRole).includes(data.role as UserRole)) {
      updates.role = data.role as UserRole;
    }

    const user = await prisma.user.update({
      where: { id: data.id },
      data: updates,
    });

    return toAdapterUser(user)!;
  },
  deleteUser: async (id) =>
    toAdapterUser(
      await prisma.user.delete({
        where: { id },
      })
    )!,
  getSessionAndUser: async (sessionToken) => {
    const sessionRecord = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!sessionRecord) {
      return null;
    }

    const { user, sessionToken: token, userId, expires } = sessionRecord;

    return {
      user: toAdapterUser(user)!,
      session: {
        sessionToken: token,
        userId,
        expires,
      },
    };
  },
};

export const authConfig: NextAuthConfig = {
  adapter: prismaAdapter,
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
        const ip = extractClientIp({
          headers: request?.headers ?? new Headers(),
          ip: (request as { ip?: string | null } | undefined)?.ip ?? null,
        });
        const deviceInfo = deriveDeviceInfo(request?.headers?.get("user-agent"));

        const securityPolicy = await getSecurityPolicy();
        const blockDurationMs = Math.max(1, securityPolicy.block.durationMinutes) * 60_000;

        const activeBlock = await isIpBlocked(ip, "login");
        if (activeBlock?.blockedUntil && activeBlock.blockedUntil > new Date()) {
          await logSecurityIncident({
            category: "login",
            source: "auth",
            description: "Percobaan login dari IP yang sedang diblokir.",
            ip,
            metadata: {
              blockedUntil: activeBlock.blockedUntil,
              email: email ?? null,
            },
          });
          throw new Error("Akses diblokir sementara. Coba lagi nanti.");
        }

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

          if (!user.emailVerified) {
            await prisma.twoFactorToken.delete({ where: { id: pendingToken.id } });
            throw new Error("Akun Anda belum aktif. Silakan cek email untuk aktivasi.");
          }

          if (!twoFactorCode) {
            throw new Error("Kode 2FA diperlukan");
          }

          const loginIdentifier = `${ip}:${user.email ?? user.id}`;

          const isValid2FA = verifyTwoFactorToken(twoFactorCode, user.twoFactorSecret);
          if (!isValid2FA) {
            const limitResult = await enforceRateLimit({
              type: "login",
              identifier: loginIdentifier,
              limit: Math.max(1, securityPolicy.login.maxAttempts),
              windowMs: Math.max(1, securityPolicy.login.windowMinutes) * 60_000,
              blockDurationMs,
              ip,
              reason: "Terlalu banyak percobaan login",
              metadata: { stage: "2fa", email: user.email },
            });
            if (!limitResult.allowed) {
              throw new Error("Terlalu banyak percobaan login. Coba lagi nanti.");
            }
            throw new Error("Kode 2FA tidak valid");
          }

          await prisma.twoFactorToken.deleteMany({ where: { id: pendingToken.id } });
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          await clearRateLimit("login", loginIdentifier);

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
        const loginIdentifier = `${ip}:${emailForPassword.toLowerCase()}`;

        const user = await prisma.user.findUnique({ where: { email: emailForPassword } });

        if (!user || !user.passwordHash) {
          const limitResult = await enforceRateLimit({
            type: "login",
            identifier: loginIdentifier,
            limit: Math.max(1, securityPolicy.login.maxAttempts),
            windowMs: Math.max(1, securityPolicy.login.windowMinutes) * 60_000,
            blockDurationMs,
            ip,
            reason: "Terlalu banyak percobaan login",
            metadata: { email: emailForPassword, stage: "credentials" },
          });
          if (!limitResult.allowed) {
            throw new Error("Terlalu banyak percobaan login. Coba lagi nanti.");
          }
          throw new Error("Email atau password salah");
        }

        const isValidPassword = await verifyPassword(passwordForCheck, user.passwordHash);
        if (!isValidPassword) {
          const limitResult = await enforceRateLimit({
            type: "login",
            identifier: loginIdentifier,
            limit: Math.max(1, securityPolicy.login.maxAttempts),
            windowMs: Math.max(1, securityPolicy.login.windowMinutes) * 60_000,
            blockDurationMs,
            ip,
            reason: "Terlalu banyak percobaan login",
            metadata: { email: emailForPassword, stage: "credentials" },
          });
          if (!limitResult.allowed) {
            throw new Error("Terlalu banyak percobaan login. Coba lagi nanti.");
          }
          throw new Error("Email atau password salah");
        }

        if (!user.emailVerified) {
          throw new Error("Akun Anda belum aktif. Silakan cek email untuk aktivasi.");
        }

        if (user.twoFactorEnabled) {
          await clearRateLimit("login", loginIdentifier);
          throw new Error("Kode 2FA diperlukan");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await clearRateLimit("login", loginIdentifier);

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
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            profile(profile) {
              return {
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                image: profile.picture,
                role: "AUTHOR",
              };
            },
          }),
        ]
      : []),
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
  events: {
    signIn: async ({ user, account, profile, isNewUser }) => {
      if (!account || account.provider !== "google") {
        return;
      }

      const userId = user.id ?? account.userId;
      if (!userId) {
        return;
      }

      const googleProfile = profile as { picture?: string | null; name?: string | null } | null;
      const updates: Prisma.UserUpdateInput = {
        lastLoginAt: new Date(),
      };

      const adapterUser = user as AdapterUser & { emailVerified?: Date | null };
      if (!adapterUser.emailVerified) {
        updates.emailVerified = new Date();
      }

      if (googleProfile?.picture) {
        updates.avatarUrl = googleProfile.picture;
      }

      if (googleProfile?.name && googleProfile.name !== user.name) {
        updates.name = googleProfile.name;
      }

      if (isNewUser) {
        const config = await getSiteConfig();
        updates.canPublish = config.registration?.autoApprove ?? false;
      }

      await prisma.user.update({
        where: { id: userId },
        data: updates,
      });

      await writeAuditLog({
        action: "USER_LOGIN",
        entity: "User",
        entityId: userId,
        userId,
        metadata: {
          loginMethod: "GOOGLE",
          email: user.email,
          providerAccountId: account.providerAccountId,
        },
      });
    },
  },
};
