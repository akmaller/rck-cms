import { NextResponse } from "next/server";

import { auth } from "./auth";
import { extractClientIp, isIpBlocked } from "./lib/security/ip-block";
import { getSecurityPolicy } from "./lib/security/policy";
import { enforceRateLimit } from "./lib/security/rate-limit";

const DASHBOARD_ROLES = new Set(["ADMIN", "EDITOR", "AUTHOR"]);


const buildCspHeader = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://static.cloudflareinsights.com"
  ];
  const allowUnsafeEval =
    !isProduction ||
    ["1", "true", "yes", "on"].includes((process.env.CSP_ALLOW_UNSAFE_EVAL ?? "").toLowerCase());
  if (allowUnsafeEval) {
    scriptSrc.push("'unsafe-eval'");
  }
  const scriptSrcExtras: string[] = [];
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    scriptSrcExtras.push("https://challenges.cloudflare.com");
  }
  const scriptSrcValues = [...scriptSrc, ...scriptSrcExtras];
  const scriptSrcElemValues = scriptSrcValues;
  const frameSrcValues = ["'self'", "https://www.googletagmanager.com"];
  if (scriptSrcExtras.includes("https://challenges.cloudflare.com")) {
    frameSrcValues.push("https://challenges.cloudflare.com");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrcValues.join(" ")}`,
    `script-src-elem ${scriptSrcElemValues.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com",
    `frame-src ${frameSrcValues.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
};

const SECURITY_HEADERS: Array<[string, string]> = [
  ["Content-Security-Policy", buildCspHeader()],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["X-XSS-Protection", "0"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
];

function applySecurityHeaders(response: NextResponse) {
  SECURITY_HEADERS.forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function disallowIndexing(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function rateLimitResponse(req: AuthenticatedRequest, retryAfter?: number | Date) {
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const retryAfterSeconds = (() => {
    if (!retryAfter) return undefined;
    if (retryAfter instanceof Date) {
      return Math.max(0, Math.ceil((retryAfter.getTime() - Date.now()) / 1000));
    }
    return Math.max(0, Math.ceil(retryAfter / 1000));
  })();

  if (isApiRoute) {
    const response = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
    if (retryAfterSeconds) {
      response.headers.set("Retry-After", retryAfterSeconds.toString());
    }
    return response;
  }

  const response = new NextResponse("Terlalu banyak permintaan. Coba lagi nanti.", { status: 429 });
  if (retryAfterSeconds) {
    response.headers.set("Retry-After", retryAfterSeconds.toString());
  }
  return response;
}

type AuthenticatedRequest = import("next/server").NextRequest & {
  ip?: string | null;
  auth?: { user?: { role?: string | null } } | null;
};

const middleware = auth(async (req) => {
  const request = req as AuthenticatedRequest;
  const { nextUrl } = request;
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
  const isApiDashboardRoute = nextUrl.pathname.startsWith("/api/dashboard");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isInternalAsset =
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/assets") ||
    nextUrl.pathname.startsWith("/favicon") ||
    nextUrl.pathname.startsWith("/sitemap") ||
    nextUrl.pathname.startsWith("/robots");

  const ip = extractClientIp({ headers: request.headers, ip: request.ip ?? null });

  if (ip && ip !== "unknown") {
    const activeBlock = await isIpBlocked(ip);
    if (activeBlock?.blockedUntil && activeBlock.blockedUntil > new Date()) {
      return applySecurityHeaders(rateLimitResponse(request, activeBlock.blockedUntil));
    }
  }

  const shouldRateLimitPage = request.method === "GET" && !isApiRoute && !isInternalAsset;
  const shouldRateLimitApi = isApiRoute && !nextUrl.pathname.startsWith("/api/health");

  if ((shouldRateLimitPage || shouldRateLimitApi) && ip && ip !== "unknown") {
    const policy = await getSecurityPolicy();
    if (shouldRateLimitApi) {
      const result = await enforceRateLimit({
        type: "api",
        identifier: `${ip}:${nextUrl.pathname}:${request.method}`,
        limit: Math.max(1, policy.api.maxRequests),
        windowMs: Math.max(1, policy.api.windowMinutes) * 60_000,
        blockDurationMs: Math.max(1, policy.block.durationMinutes) * 60_000,
        ip,
        reason: "Terlalu banyak permintaan API",
        metadata: {
          path: nextUrl.pathname,
          method: request.method,
        },
      });
      if (!result.allowed) {
        return applySecurityHeaders(rateLimitResponse(request, result.retryAfter));
      }
    } else if (shouldRateLimitPage) {
      const result = await enforceRateLimit({
        type: "page",
        identifier: `${ip}:${nextUrl.pathname}`,
        limit: Math.max(1, policy.page.maxVisits),
        windowMs: Math.max(1, policy.page.windowMinutes) * 60_000,
        blockDurationMs: Math.max(1, policy.block.durationMinutes) * 60_000,
        ip,
        reason: "Terlalu banyak kunjungan halaman",
        metadata: {
          path: nextUrl.pathname,
        },
      });
      if (!result.allowed) {
        return applySecurityHeaders(rateLimitResponse(request, result.retryAfter));
      }
    }
  }

  const isProtectedApiRoute =
    isApiRoute &&
    !nextUrl.pathname.startsWith("/api/auth") &&
    !nextUrl.pathname.startsWith("/api/health") &&
    !nextUrl.pathname.startsWith("/api/public");

  if (isDashboardRoute || isApiDashboardRoute) {
    if (!request.auth?.user) {
      const signInUrl = new URL("/login", nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", nextUrl.href);
      if (isApiDashboardRoute) {
        return applySecurityHeaders(
          disallowIndexing(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          )
        );
      }
      const redirectResponse = NextResponse.redirect(signInUrl);
      disallowIndexing(redirectResponse);
      return applySecurityHeaders(redirectResponse);
    }

    const role = (request.auth?.user as { role?: string | null } | null)?.role ?? "";
    if (!DASHBOARD_ROLES.has(role)) {
      if (isApiDashboardRoute) {
        return applySecurityHeaders(
          disallowIndexing(
            NextResponse.json({ error: "Forbidden" }, { status: 403 })
          )
        );
      }
      const redirectResponse = NextResponse.redirect(new URL("/", nextUrl.origin));
      disallowIndexing(redirectResponse);
      return applySecurityHeaders(redirectResponse);
    }
  }

  if (isProtectedApiRoute && !request.auth?.user) {
    return applySecurityHeaders(
      disallowIndexing(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
    );
  }

  const response = NextResponse.next();
  if (isDashboardRoute || isApiDashboardRoute) {
    disallowIndexing(response);
  }

  return applySecurityHeaders(response);
});

export default middleware as unknown as import("next/server").NextMiddleware;

export const config = {
  matcher: ["/:path*"],
};
