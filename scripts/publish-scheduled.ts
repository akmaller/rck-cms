import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { publishDueScheduledArticles } from "@/lib/articles/publish-scheduler";

async function main() {
  const result = await publishDueScheduledArticles();

  console.log(`[publish-scheduled] updated=${result.updated} slugs=${result.slugs.join(",") || "-"}`);
}

main()
  .catch((error) => {
    console.error("[publish-scheduled] Gagal menjalankan scheduler:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
