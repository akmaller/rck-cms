CREATE TABLE IF NOT EXISTS "ArticleVisitDailySummary" (
  "day" date NOT NULL,
  "path" text NOT NULL,
  "uniqueVisitors" integer NOT NULL DEFAULT 0,
  "views" integer NOT NULL DEFAULT 0,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleVisitDailySummary_pkey" PRIMARY KEY ("day", "path")
);

CREATE INDEX IF NOT EXISTS "ArticleVisitDailySummary_path_idx" ON "ArticleVisitDailySummary"("path");
CREATE INDEX IF NOT EXISTS "ArticleVisitDailySummary_day_idx" ON "ArticleVisitDailySummary"("day");
CREATE INDEX IF NOT EXISTS "ArticleVisitDailySummary_day_path_idx" ON "ArticleVisitDailySummary"("day", "path");
