import { NextRequest, NextResponse } from "next/server";

import { purgeVisitLog } from "@/lib/analytics/purge-visit-log";

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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeVisitLog();
  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
