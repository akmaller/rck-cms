import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { decryptJsonPayload, encryptJsonPayload } from "@/lib/security/encryption";

type QueueStatsRow = {
  status: string;
  count: bigint;
};

type SocialAutopostStatus = {
  enabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  twitterEnabled: boolean;
};

function mask(value: string | undefined) {
  if (!value || !value.trim()) {
    return "missing";
  }
  const trimmed = value.trim();
  if (trimmed.length <= 10) {
    return `set(len=${trimmed.length})`;
  }
  return `set(len=${trimmed.length}, head=${trimmed.slice(0, 4)}..., tail=...${trimmed.slice(-4)})`;
}

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

function checkCredentialKey() {
  const packed = encryptJsonPayload({ ok: true, ts: Date.now() });
  const decoded = decryptJsonPayload<{ ok?: boolean }>(packed);
  if (!decoded.ok) {
    throw new Error("Roundtrip enkripsi gagal");
  }
}

async function printQueueStats() {
  const rows = await prisma.$queryRaw<QueueStatsRow[]>`
    SELECT "status", COUNT(*)::bigint AS "count"
    FROM "SocialPostJob"
    GROUP BY "status"
    ORDER BY "status" ASC
  `;

  if (rows.length === 0) {
    console.log("[scheduler-doctor] queue: kosong");
    return;
  }

  const pairs = rows.map((row) => `${row.status}=${Number(row.count)}`);
  console.log(`[scheduler-doctor] queue: ${pairs.join(" ")}`);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

async function getSocialAutopostStatusFromDb(): Promise<SocialAutopostStatus> {
  const record = await prisma.siteConfig.findUnique({
    where: { key: "general" },
    select: { value: true },
  });

  const root =
    record && typeof record.value === "object" && record.value !== null && !Array.isArray(record.value)
      ? (record.value as Record<string, unknown>)
      : {};
  const socialAutopost =
    typeof root.socialAutopost === "object" && root.socialAutopost !== null && !Array.isArray(root.socialAutopost)
      ? (root.socialAutopost as Record<string, unknown>)
      : {};
  const facebook =
    typeof socialAutopost.facebook === "object" &&
    socialAutopost.facebook !== null &&
    !Array.isArray(socialAutopost.facebook)
      ? (socialAutopost.facebook as Record<string, unknown>)
      : {};
  const instagram =
    typeof socialAutopost.instagram === "object" &&
    socialAutopost.instagram !== null &&
    !Array.isArray(socialAutopost.instagram)
      ? (socialAutopost.instagram as Record<string, unknown>)
      : {};
  const twitter =
    typeof socialAutopost.twitter === "object" &&
    socialAutopost.twitter !== null &&
    !Array.isArray(socialAutopost.twitter)
      ? (socialAutopost.twitter as Record<string, unknown>)
      : {};

  return {
    enabled: readBoolean(socialAutopost.enabled, false),
    facebookEnabled: readBoolean(facebook.enabled, false),
    instagramEnabled: readBoolean(instagram.enabled, false),
    twitterEnabled: readBoolean(twitter.enabled, false),
  };
}

async function main() {
  console.log("[scheduler-doctor] env DATABASE_URL:", mask(process.env.DATABASE_URL));
  console.log("[scheduler-doctor] env CRON_SECRET:", mask(process.env.CRON_SECRET || process.env.SCHEDULER_SECRET));
  console.log("[scheduler-doctor] env SOCIAL_CREDENTIALS_KEY:", mask(process.env.SOCIAL_CREDENTIALS_KEY));

  await checkDatabase();
  console.log("[scheduler-doctor] database: ok");

  checkCredentialKey();
  console.log("[scheduler-doctor] encryption-key: ok");

  const config = await getSocialAutopostStatusFromDb();
  console.log(
    `[scheduler-doctor] socialAutopost: enabled=${config.enabled} facebook=${config.facebookEnabled} instagram=${config.instagramEnabled} twitter=${config.twitterEnabled}`
  );

  await printQueueStats();
}

main()
  .catch((error) => {
    console.error("[scheduler-doctor] gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
