import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { dispatchSocialPostJobs } from "@/lib/social/dispatcher";

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  const limit = parsePositiveInt(readArg("limit"), 20);
  const maxRetryCount = parsePositiveInt(readArg("maxRetryCount"), 5);

  const result = await dispatchSocialPostJobs({ limit, maxRetryCount });

  console.log(
    `[social-dispatch] scanned=${result.scanned} claimed=${result.claimed} posted=${result.posted} failed=${result.failed} skipped=${result.skipped}`
  );
}

main()
  .catch((error) => {
    console.error("[social-dispatch] Gagal menjalankan dispatcher:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
