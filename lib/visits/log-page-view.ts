import { prisma } from "@/lib/prisma";
import { deriveDeviceInfo } from "@/lib/device-info";

export type LogPageViewInput = {
  path: string;
  url?: string | null;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

function sanitize(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function logPageView({ path, url, referrer, ip, userAgent }: LogPageViewInput) {
  if (!path) {
    return;
  }

  const info = deriveDeviceInfo(userAgent ?? null);

  if (info.deviceType === "bot") {
    return;
  }

  try {
    await prisma.visitLog.create({
      data: {
        path,
        url: sanitize(url),
        referrer: sanitize(referrer),
        ip: sanitize(ip),
        userAgent: sanitize(info.userAgent),
        browser: sanitize(info.browser),
        os: sanitize(info.os),
        deviceType: info.deviceType,
      },
    });
  } catch (error) {
    console.error("Failed to log page view", error);
  }
}
