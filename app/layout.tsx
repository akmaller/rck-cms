import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { GoogleTagManager } from "@/components/analytics/google-tag-manager";
import { createMetadata } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config/server";
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
  const config = await getSiteConfig();
  const baseMetadata = await createMetadata({
    config,
    title: config.metadata.title ?? config.name,
    description: config.metadata.description ?? config.description,
    path: "/",
  });

  const defaultTitle = typeof baseMetadata.title === "string" ? baseMetadata.title : config.name;
  const iconUrl = config.iconUrl?.trim();
  const defaultIconHref = iconUrl || "/default-favicon.ico";
  const appleIconHref =
    iconUrl && iconUrl.toLowerCase().endsWith(".png") ? iconUrl : "/apple-touch-icon.png";

  return {
    ...baseMetadata,
    metadataBase: new URL(config.url),
    title: {
      default: defaultTitle,
      template: `%s | ${config.name}`,
    },
    icons: {
      icon: defaultIconHref,
      shortcut: defaultIconHref,
      apple: appleIconHref,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig();
  const rawTagId = config.analytics?.googleTagManagerId?.trim() ?? null;
  const googleTagManagerId = rawTagId && rawTagId.length > 0 ? rawTagId : null;
  const normalizedTag = googleTagManagerId?.toUpperCase() ?? null;
  const useNoscript = normalizedTag?.startsWith("GTM-") ?? false;

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {googleTagManagerId ? (
          <GoogleTagManager containerId={googleTagManagerId} placement="head" />
        ) : null}
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        {googleTagManagerId && useNoscript ? (
          <GoogleTagManager containerId={googleTagManagerId} placement="body" />
        ) : null}
        {children}
      </body>
    </html>
  );
}
