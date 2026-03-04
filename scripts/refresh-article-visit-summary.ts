import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { refreshArticleVisitSummary } from "@/lib/analytics/article-visit-summary";

function readArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function main() {
  const fromDate = parseDate(readArg("from"));
  const toDate = parseDate(readArg("to"));

  const result = await refreshArticleVisitSummary({ fromDate, toDate });

  console.log(`[visit-summary-refresh] from=${result.fromDate} to=${result.toDate} rows=${result.rows}`);
}

main()
  .catch((error) => {
    console.error("[visit-summary-refresh] Gagal menjalankan refresh:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
