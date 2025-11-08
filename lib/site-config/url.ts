const ENV_SITE_URL_CANDIDATES = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.SITE_URL,
] as const;

const coerceUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export function resolvePreferredSiteUrl(preferred?: string | null) {
  if (preferred) {
    const primary = coerceUrl(preferred);
    if (primary) {
      return primary;
    }
  }

  for (const candidate of ENV_SITE_URL_CANDIDATES) {
    const url = coerceUrl(candidate ?? null);
    if (url) {
      return url;
    }
  }

  return null;
}

type HeaderGetter = {
  get(name: string): string | null;
} | null | undefined;

export function resolveRuntimeBaseUrl(headerList: HeaderGetter) {
  if (!headerList) return null;
  const forwardedHost = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!forwardedHost) {
    return null;
  }
  const forwardedProto =
    headerList.get("x-forwarded-proto") ?? (forwardedHost.includes("localhost") ? "http" : "https");
  try {
    return new URL(`${forwardedProto}://${forwardedHost}`);
  } catch {
    return null;
  }
}

export function toAbsoluteAssetUrl(
  value: string | null | undefined,
  base: URL | null | undefined
) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return base ? new URL(trimmed, base).toString() : new URL(trimmed).toString();
  } catch {
    if (!base) {
      return trimmed;
    }
    try {
      return new URL(trimmed.replace(/^\/+/, ""), base).toString();
    } catch {
      return trimmed;
    }
  }
}
