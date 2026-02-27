import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { purgeVisitLog } from "@/lib/analytics/purge-visit-log";

async function main() {
  const result = await purgeVisitLog();

  console.log(
    `[purge-visit-log] Retention visit=${result.visitRetentionDays} hari, summary=${
      result.summaryRetentionDays === null ? "all-time (tidak dipurge)" : `${result.summaryRetentionDays} hari`
    }.`
  );
  console.log(
    `[purge-visit-log] Menghapus VisitLog sebelum ${result.visitCutoffIso}, total terhapus: ${result.visitDeleted}.`
  );
  if (result.summaryCutoffIso) {
    console.log(
      `[purge-visit-log] Menghapus ArticleVisitDailySummary sebelum ${result.summaryCutoffIso}, total terhapus: ${result.summaryDeleted}.`
    );
  } else {
    console.log("[purge-visit-log] ArticleVisitDailySummary dipertahankan all-time (tidak ada penghapusan).");
  }
}

main()
  .catch((error) => {
    console.error("[purge-visit-log] Gagal menjalankan purge:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
