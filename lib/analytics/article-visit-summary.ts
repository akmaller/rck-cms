import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const ARTICLE_PATH_PREFIX = "/articles/";

export type RefreshArticleVisitSummaryInput = {
  fromDate?: Date;
  toDate?: Date;
};

export type RefreshArticleVisitSummaryResult = {
  fromDate: string;
  toDate: string;
  rows: number;
};

function startOfUtcDay(input: Date) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function addUtcDays(input: Date, days: number) {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export async function refreshArticleVisitSummary(
  input: RefreshArticleVisitSummaryInput = {}
): Promise<RefreshArticleVisitSummaryResult> {
  const todayStart = startOfUtcDay(new Date());
  const from = startOfUtcDay(input.fromDate ?? addUtcDays(todayStart, -14));
  const to = startOfUtcDay(input.toDate ?? todayStart);
  const toExclusive = addUtcDays(to, 1);
  const fromDay = from.toISOString().slice(0, 10);
  const toExclusiveDay = toExclusive.toISOString().slice(0, 10);

  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        DELETE FROM "ArticleVisitDailySummary"
        WHERE "day" >= CAST(${fromDay} AS date)
          AND "day" < CAST(${toExclusiveDay} AS date)
      `
    );

    const inserted = await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO "ArticleVisitDailySummary" ("day", "path", "uniqueVisitors", "views", "updatedAt")
        SELECT
          DATE("createdAt") AS "day",
          "path",
          COUNT(DISTINCT "ip") FILTER (WHERE "ip" IS NOT NULL)::integer AS "uniqueVisitors",
          COUNT(*)::integer AS "views",
          NOW() AS "updatedAt"
        FROM "VisitLog"
        WHERE "createdAt" >= ${from}
          AND "createdAt" < ${toExclusive}
          AND "path" LIKE ${`${ARTICLE_PATH_PREFIX}%`}
        GROUP BY DATE("createdAt"), "path"
        ON CONFLICT ("day", "path")
        DO UPDATE SET
          "uniqueVisitors" = EXCLUDED."uniqueVisitors",
          "views" = EXCLUDED."views",
          "updatedAt" = NOW()
      `
    );

    return Number(inserted ?? 0);
  });

  return {
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
    rows,
  };
}

export async function getArticleUniqueVisitors(path: string): Promise<number> {
  if (!path || !path.startsWith(ARTICLE_PATH_PREFIX)) {
    return 0;
  }

  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>(
    Prisma.sql`
      SELECT COALESCE(SUM("uniqueVisitors"), 0)::bigint AS total
      FROM "ArticleVisitDailySummary"
      WHERE "path" = ${path}
    `
  );

  return Number(rows[0]?.total ?? 0);
}

export async function getArticleUniqueVisitorsByPaths(paths: string[]): Promise<Map<string, number>> {
  const filtered = Array.from(new Set(paths.filter((path) => path.startsWith(ARTICLE_PATH_PREFIX))));
  if (filtered.length === 0) {
    return new Map<string, number>();
  }

  const pathList = Prisma.join(filtered.map((path) => Prisma.sql`${path}`));
  const rows = await prisma.$queryRaw<Array<{ path: string; total: bigint }>>(
    Prisma.sql`
      SELECT "path", COALESCE(SUM("uniqueVisitors"), 0)::bigint AS total
      FROM "ArticleVisitDailySummary"
      WHERE "path" IN (${pathList})
      GROUP BY "path"
    `
  );

  const result = new Map<string, number>();
  rows.forEach((row) => result.set(row.path, Number(row.total)));
  return result;
}

export async function getTopArticlePathsByUniqueVisitors(days: number, limit: number): Promise<string[]> {
  const safeDays = Math.max(1, Math.floor(days));
  const safeLimit = Math.max(1, Math.floor(limit));
  const todayStart = startOfUtcDay(new Date());
  const from = addUtcDays(todayStart, -(safeDays - 1));

  const rows = await prisma.$queryRaw<Array<{ path: string; total: bigint }>>(
    Prisma.sql`
      SELECT "path", COALESCE(SUM("uniqueVisitors"), 0)::bigint AS total
      FROM "ArticleVisitDailySummary"
      WHERE "day" >= ${from}
      GROUP BY "path"
      ORDER BY total DESC
      LIMIT ${safeLimit}
    `
  );

  return rows
    .map((row) => row.path)
    .filter((path) => path.startsWith(ARTICLE_PATH_PREFIX));
}
