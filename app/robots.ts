import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/lib/site-config/server";

const DISALLOWED_PATHS = ["/api/", "/admin/", "/auth/", "/dashboard/", "/internal/", "/tmp/"];

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getSiteConfig();
  const baseUrl = config.url.replace(/\/$/, "");
  let host: string | undefined;
  try {
    host = new URL(baseUrl).host || undefined;
  } catch {
    host = undefined;
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host,
  };
}
