import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

  return {
    ...baseMetadata,
    metadataBase: new URL(config.url),
    title: {
      default: defaultTitle,
      template: `%s | ${config.name}`,
    },
    icons: iconUrl ? { icon: iconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}
