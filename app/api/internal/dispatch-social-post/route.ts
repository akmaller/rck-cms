import { NextRequest, NextResponse } from "next/server";

import { dispatchSocialPostJobs } from "@/lib/social/dispatcher";

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

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return num;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
  const maxRetryCount = parsePositiveInt(request.nextUrl.searchParams.get("maxRetryCount"), 5);

  const result = await dispatchSocialPostJobs({ limit, maxRetryCount });
  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
