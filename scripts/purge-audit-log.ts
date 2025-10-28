import "dotenv/config";

import { subDays } from "date-fns";

import { prisma } from "@/lib/prisma";
import { flushAuditLogsImmediately } from "@/lib/audit/log";

function parseRetentionDays(envValue: string | undefined, fallback: number) {
  if (!envValue) return fallback;
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

async function main() {
  const retentionDays = parseRetentionDays(process.env.AUDIT_LOG_RETENTION_DAYS, 90);
  const cutoff = subDays(new Date(), retentionDays);

  console.log(
    `[purge-audit-log] Retention ${retentionDays} hari. Menghapus catatan sebelum ${cutoff.toISOString()}`
  );

  await flushAuditLogsImmediately();

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  console.log(`[purge-audit-log] Berhasil menghapus ${result.count} catatan audit lama.`);
}

main()
  .catch((error) => {
    console.error("[purge-audit-log] Gagal menjalankan purge:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
