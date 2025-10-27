import { NextResponse } from "next/server";

import { siteConfig as defaultSiteConfig } from "@/config/site";
import { getSiteConfig } from "@/lib/site-config/server";

const FALLBACK_ICON_PATH = "/default-favicon.ico";

const resolveIconUrl = (target: string | null | undefined, request: Request): URL | null => {
  if (!target) {
    return null;
  }
  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed);
    }
    return new URL(trimmed, request.url);
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  let config = defaultSiteConfig;
  try {
    config = await getSiteConfig();
  } catch {
    // Ignore errors and use default config as a fallback.
  }

  const candidates = [
    config.iconUrl,
    defaultSiteConfig.iconUrl,
    FALLBACK_ICON_PATH,
  ];

  const selected = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  const resolved = resolveIconUrl(selected, request) ?? resolveIconUrl(FALLBACK_ICON_PATH, request);
  if (!resolved) {
    return new Response(null, { status: 404 });
  }

  const current = new URL(request.url);
  if (resolved.origin === current.origin && resolved.pathname === current.pathname) {
    const fallback = resolveIconUrl(FALLBACK_ICON_PATH, request);
    if (fallback && (fallback.origin !== current.origin || fallback.pathname !== current.pathname)) {
      return NextResponse.redirect(fallback, { status: 302 });
    }
    return new Response(null, { status: 404 });
  }

  return NextResponse.redirect(resolved, { status: 302 });
}
