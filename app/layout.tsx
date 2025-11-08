import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";

import { GoogleTagManager } from "@/components/analytics/google-tag-manager";
import { createMetadata } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config/server";
import { resolvePreferredSiteUrl, resolveRuntimeBaseUrl, toAbsoluteAssetUrl } from "@/lib/site-config/url";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const runtimeBaseUrl = resolveRuntimeBaseUrl(headerList);
  const config = await getSiteConfig();
  const configuredBaseUrl = resolvePreferredSiteUrl(config.url);
  const effectiveBaseUrl = runtimeBaseUrl ?? configuredBaseUrl;
  const effectiveConfig = effectiveBaseUrl ? { ...config, url: effectiveBaseUrl.toString() } : config;

  const baseMetadata = await createMetadata({
    config: effectiveConfig,
    title: config.metadata.title ?? config.name,
    description: config.metadata.description ?? config.description,
    path: "/",
  });

  const metadataBase = effectiveBaseUrl ?? configuredBaseUrl;
  const defaultTitle = typeof baseMetadata.title === "string" ? baseMetadata.title : config.name;
  const iconUrl = config.iconUrl?.trim() || null;
  const iconHref =
    toAbsoluteAssetUrl(iconUrl, metadataBase ?? undefined) ??
    (metadataBase ? new URL("/default-favicon.ico", metadataBase).toString() : "/default-favicon.ico");

  const appleIconHref =
    iconUrl && iconUrl.toLowerCase().endsWith(".png")
      ? toAbsoluteAssetUrl(iconUrl, metadataBase ?? undefined)
      : metadataBase
        ? new URL("/apple-touch-icon.png", metadataBase).toString()
        : "/apple-touch-icon.png";
  const appleIcons = appleIconHref ? [appleIconHref] : undefined;

  return {
    ...baseMetadata,
    metadataBase: metadataBase ?? undefined,
    title: {
      default: defaultTitle,
      template: `%s | ${config.name}`,
    },
    icons: {
      icon: iconHref,
      shortcut: iconHref,
      apple: appleIcons,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig();
  const rawTagId = config.analytics?.googleTagManagerId?.trim() ?? null;
  const googleTagManagerId = rawTagId && rawTagId.length > 0 ? rawTagId : null;
  const normalizedTag = googleTagManagerId?.toUpperCase() ?? null;
  const useNoscript = normalizedTag?.startsWith("GTM-") ?? false;
  const enableAnalytics =
    process.env.NODE_ENV === "production" && googleTagManagerId !== null;
  const resolvedContainerId = enableAnalytics ? googleTagManagerId : null;

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {resolvedContainerId ? (
          <GoogleTagManager containerId={resolvedContainerId} placement="head" />
        ) : null}
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        {resolvedContainerId && useNoscript ? (
          <GoogleTagManager containerId={resolvedContainerId} placement="body" />
        ) : null}
        {children}
      </body>
    </html>
  );
}
