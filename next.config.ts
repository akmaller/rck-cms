import type { NextConfig } from "next";

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

const imagesRemotePatterns = (() => {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.SITE_URL,
    process.env.R2_PUBLIC_BASE_URL,
  ];

  const patterns: RemotePattern[] = [];
  const seen = new Set<string>();

  const addPattern = (pattern: RemotePattern) => {
    const protocol = pattern.protocol ?? "https";
    const key = `${protocol}://${pattern.hostname}${pattern.pathname ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      patterns.push(pattern);
    }
  };

  const addFromUrl = (input: string) => {
    try {
      const url = new URL(input);
      const protocol = url.protocol.replace(":", "");
      if (protocol !== "http" && protocol !== "https") {
        return;
      }
      const normalizedPath = url.pathname.replace(/\/+$/, "");
      const pathname =
        normalizedPath.length > 0 && normalizedPath !== "/"
          ? `${normalizedPath}/**`
          : "/**";
      addPattern({
        protocol: protocol as "http" | "https",
        hostname: url.hostname,
        pathname,
      });
    } catch {
      // Ignore invalid URLs
    }
  };

  candidates.filter(Boolean).forEach((input) => addFromUrl(input!));

  const defaultRemotePatterns: RemotePattern[] = [
    { protocol: "https", hostname: "*.googleusercontent.com", pathname: "/**" },
    { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    { protocol: "https", hostname: "lh4.googleusercontent.com", pathname: "/**" },
    { protocol: "https", hostname: "lh5.googleusercontent.com", pathname: "/**" },
    { protocol: "https", hostname: "lh6.googleusercontent.com", pathname: "/**" },
    { protocol: "https", hostname: "secure.gravatar.com", pathname: "/avatar/**" },
    { protocol: "https", hostname: "gravatar.com", pathname: "/avatar/**" },
  ];

  defaultRemotePatterns.forEach(addPattern);

  const extraHostsRaw =
    process.env.NEXT_REMOTE_IMAGE_HOSTS ?? process.env.NEXT_PUBLIC_REMOTE_IMAGE_HOSTS ?? "";
  extraHostsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const hasProtocol = /^[a-z]+:\/\//i.test(value);
      const candidateUrl = hasProtocol ? value : `https://${value}`;
      try {
        const url = new URL(candidateUrl);
        const protocol = url.protocol.replace(":", "");
        if (protocol !== "http" && protocol !== "https") {
          return;
        }
        const normalizedPath = url.pathname.replace(/\/+$/, "");
        const pathname =
          normalizedPath.length > 0 && normalizedPath !== "/"
            ? `${normalizedPath}/**`
            : "/**";
        addPattern({
          protocol: protocol as "http" | "https",
          hostname: url.hostname,
          pathname,
        });
      } catch {
        // Ignore invalid values
      }
    });

  return patterns;
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
