import { subDays } from "date-fns";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function parseRetentionDays(envValue: string | undefined, fallback: number) {
  if (!envValue) return fallback;
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseOptionalRetentionDays(envValue: string | undefined, fallback: number) {
  if (!envValue) return fallback;
  const normalized = envValue.trim().toLowerCase();
  if (["0", "off", "false", "none", "never", "infinite"].includes(normalized)) {
    return null;
  }
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export type PurgeVisitLogResult = {
  visitRetentionDays: number;
  summaryRetentionDays: number | null;
  visitDeleted: number;
  summaryDeleted: number;
  visitCutoffIso: string;
  summaryCutoffIso: string | null;
};

export async function purgeVisitLog(): Promise<PurgeVisitLogResult> {
  const visitRetentionDays = parseRetentionDays(process.env.VISIT_LOG_RETENTION_DAYS, 180);
  const summaryRetentionDays = parseOptionalRetentionDays(
    process.env.ARTICLE_VISIT_SUMMARY_RETENTION_DAYS,
    Math.max(visitRetentionDays, 365)
  );

  const visitCutoff = subDays(new Date(), visitRetentionDays);
  const summaryCutoff = summaryRetentionDays === null ? null : subDays(new Date(), summaryRetentionDays);

  const [visitDeleteResult, summaryDeleteCount] = await Promise.all([
    prisma.visitLog.deleteMany({
      where: { createdAt: { lt: visitCutoff } },
    }),
    summaryCutoff === null
      ? Promise.resolve(0)
      : prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM "ArticleVisitDailySummary"
            WHERE "day" < ${summaryCutoff}
          `
        ),
  ]);

  return {
    visitRetentionDays,
    summaryRetentionDays,
    visitDeleted: visitDeleteResult.count,
    summaryDeleted: Number(summaryDeleteCount ?? 0),
    visitCutoffIso: visitCutoff.toISOString(),
    summaryCutoffIso: summaryCutoff ? summaryCutoff.toISOString() : null,
  };
}
