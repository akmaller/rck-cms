import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { getSiteConfig } from "@/lib/site-config/server";

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
  const title = config.metadata.title ?? config.name;
  const description = config.metadata.description ?? config.description;
  const ogImage = config.ogImage ?? config.logoUrl ?? "/og.jpg";

  return {
    metadataBase: new URL(config.url),
    title: {
      default: title,
      template: `%s | ${config.name}`,
    },
    description,
    icons: config.logoUrl ? { icon: config.logoUrl } : undefined,
    openGraph: {
      title,
      description,
      url: config.url,
      siteName: config.name,
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: config.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
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
