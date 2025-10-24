import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: NextRequest, context: AuthRouteContext) {
  await context.params;
  return handlers.GET(request);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  await context.params;
  return handlers.POST(request);
}
