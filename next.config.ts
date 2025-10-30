import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  async redirects() {
    const redirectRules: Array<{
      source: string;
      destination: string;
      permanent: boolean;
      has: Array<{ type: "host"; value: string }>;
    }> = [];

    const canonicalEnv =
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? process.env.SITE_URL ?? "";

    let canonicalUrl: URL | null = null;
    if (canonicalEnv) {
      try {
        canonicalUrl = new URL(canonicalEnv);
      } catch {
        canonicalUrl = null;
      }
    }

    if (canonicalUrl) {
      const host = canonicalUrl.hostname;
      const protocol = canonicalUrl.protocol;
      const skipHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

      if (!skipHosts.has(host) && host) {
        if (host.startsWith("www.")) {
          const bareHost = host.replace(/^www\./, "");
          if (bareHost && bareHost !== host) {
            redirectRules.push({
              source: "/:path*",
              has: [{ type: "host", value: bareHost }],
              destination: `${protocol}//${host}/:path*`,
              permanent: true,
            });
          }
        } else {
          redirectRules.push({
            source: "/:path*",
            has: [{ type: "host", value: `www.${host}` }],
            destination: `${protocol}//${host}/:path*`,
            permanent: true,
          });
        }
      }
    }

    return redirectRules;
  },
};

export default nextConfig;
