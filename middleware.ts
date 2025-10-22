import { NextResponse } from "next/server";

import { auth } from "./auth";

const DASHBOARD_ROLES = new Set(["ADMIN", "EDITOR", "AUTHOR"]);

export default auth((req) => {
  const { nextUrl } = req;
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
  const isApiDashboardRoute = nextUrl.pathname.startsWith("/api/dashboard");

  if (isDashboardRoute || isApiDashboardRoute) {
    if (!req.auth?.user) {
      const signInUrl = new URL("/login", nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }

    const role = (req.auth.user as { role?: string }).role ?? "";
    if (!DASHBOARD_ROLES.has(role)) {
      return NextResponse.redirect(new URL("/", nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
