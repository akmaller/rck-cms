"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { DashboardNotificationBell } from "@/components/layout/dashboard/dashboard-notification-bell";

type AuthFetcherResult =
  | { authenticated: true; role?: string | null }
  | { authenticated: false };

async function fetchAuthStatus(): Promise<AuthFetcherResult> {
  if (typeof window === "undefined") {
    return { authenticated: false };
  }

  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      return { authenticated: false };
    }
    const data = await response.json();
    if (data?.user) {
      return { authenticated: true, role: data.user.role ?? null };
    }
    return { authenticated: false };
  } catch (error) {
    console.error("Failed to fetch session", error);
    return { authenticated: false };
  }
}

export function PublicAuthActions() {
  const [state, setState] = useState<{ loading: boolean; authenticated: boolean }>({
    loading: true,
    authenticated: false,
  });

  useEffect(() => {
    let mounted = true;
    fetchAuthStatus().then((result) => {
      if (!mounted) return;
      setState({ loading: false, authenticated: result.authenticated });
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.authenticated) {
    return (
      <div className="flex items-center gap-2">
        <DashboardNotificationBell />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/60 hover:text-primary"
        >
          <ArrowRight className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <Link className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90" href="/login">
      <LogIn className="h-4 w-4" />
      Masuk
    </Link>
  );
}
