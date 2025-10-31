import type { NextConfig } from "next";

const imagesRemotePatterns: NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> = (() => {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.SITE_URL,
    process.env.R2_PUBLIC_BASE_URL,
  ];

  const seen = new Set<string>();

  return candidates
    .map((input) => {
      if (!input) return null;
      try {
        const url = new URL(input);
        const key = `${url.protocol}//${url.hostname}${url.pathname}`;
        if (seen.has(key)) {
          return null;
        }
        seen.add(key);

        const normalizedPath = url.pathname.replace(/\/?$/, "");
        const pathname =
          normalizedPath.length > 0 && normalizedPath !== "/"
            ? `${normalizedPath.replace(/\/+$/, "")}/**`
            : "/**";

        const protocol = url.protocol.replace(":", "");
        if (protocol !== "http" && protocol !== "https") {
          return null;
        }

        return {
          protocol: protocol as "http" | "https",
          hostname: url.hostname,
          pathname,
        };
      } catch {
        return null;
      }
    })
    .filter((pattern): pattern is NonNullable<typeof pattern> => Boolean(pattern));
})();

const disableImageOptimization =
  process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION === "1" ||
  process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION === "true";

const nextConfig: NextConfig = {
  images: {
    unoptimized: disableImageOptimization,
    remotePatterns: imagesRemotePatterns.length > 0 ? imagesRemotePatterns : undefined,
  },
  poweredByHeader: false,
  async headers() {
    if (process.env.NODE_ENV === "development") {
      return [];
    }

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
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
