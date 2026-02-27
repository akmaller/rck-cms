import { NextRequest, NextResponse } from "next/server";

import { refreshArticleVisitSummary } from "@/lib/analytics/article-visit-summary";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.SCHEDULER_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token === secret) {
      return true;
    }
  }

  return request.headers.get("x-cron-secret")?.trim() === secret;
}

function parseDateParam(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromDate = parseDateParam(request.nextUrl.searchParams.get("from"));
  const toDate = parseDateParam(request.nextUrl.searchParams.get("to"));
  const result = await refreshArticleVisitSummary({ fromDate, toDate });

  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
