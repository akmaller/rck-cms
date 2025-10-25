"use server";

import type { Metadata } from "next";

import { getSiteConfig } from "@/lib/site-config/server";
import type { ResolvedSiteConfig } from "@/lib/site-config/types";

type NullableDate = Date | string | null | undefined;

type ImageInput = {
  url: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
};

type MetadataOptions = {
  config?: ResolvedSiteConfig;
  title?: string;
  description?: string;
  keywords?: string[];
  path?: string;
  image?: ImageInput | null;
  type?: "website" | "article";
  tags?: string[];
  authors?: string[];
  publishedTime?: NullableDate;
  modifiedTime?: NullableDate;
  robots?: {
    index?: boolean;
    follow?: boolean;
    nocache?: boolean;
    googleBot?: {
      index?: boolean;
      follow?: boolean;
      nocache?: boolean;
      noimageindex?: boolean;
      nosnippet?: boolean;
    };
  };
};

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function toIsoDate(value: NullableDate) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function mergeKeywords(base: string[], extras?: string[]) {
  const entries: Array<{ key: string; value: string }> = [];
  base
    .filter((item): item is string => Boolean(item && item.trim()))
    .forEach((item) => entries.push({ key: item.trim().toLowerCase(), value: item.trim() }));

  extras
    ?.filter((item): item is string => Boolean(item && item.trim()))
    .forEach((item) => {
      const trimmed = item.trim();
      entries.push({ key: trimmed.toLowerCase(), value: trimmed });
    });

  const unique = new Map<string, string>();
  entries.forEach(({ key, value }) => {
    if (!unique.has(key)) {
      unique.set(key, value);
    }
  });

  return unique.size ? Array.from(unique.values()) : undefined;
}

export async function createMetadata(options: MetadataOptions = {}): Promise<Metadata> {
  const config = options.config ?? (await getSiteConfig());

  const baseTitle = config.metadata.title ?? config.name;
  const resolvedTitle = options.title?.trim() || baseTitle;
  const description =
    options.description?.trim() || config.metadata.description || config.description;
  const canonicalPath = options.path?.startsWith("/") ? options.path : options.path ? `/${options.path}` : "/";
  const canonicalUrl = toAbsoluteUrl(canonicalPath, config.url) ?? config.url;

  const resolvedImage = options.image ?? (config.ogImage ? { url: config.ogImage, alt: config.name } : null);
  const absoluteImageUrl = resolvedImage ? toAbsoluteUrl(resolvedImage.url, config.url) : null;
  const mergedKeywords = mergeKeywords(config.metadata.keywords ?? [], options.keywords);
  const metadataType = options.type ?? "website";

  const metadata: Metadata = {
    title: resolvedTitle,
    description,
    keywords: mergedKeywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: resolvedTitle,
      description,
      url: canonicalUrl,
      siteName: config.name,
      locale: "id_ID",
      type: metadataType,
      images: absoluteImageUrl
        ? [
            {
              url: absoluteImageUrl,
              width: resolvedImage?.width ?? 1200,
              height: resolvedImage?.height ?? 630,
              alt: resolvedImage?.alt ?? resolvedTitle,
            },
          ]
        : undefined,
      ...(metadataType === "article"
        ? {
            publishedTime: toIsoDate(options.publishedTime),
            modifiedTime: toIsoDate(options.modifiedTime),
            authors: options.authors && options.authors.length > 0 ? options.authors : undefined,
            tags: options.tags && options.tags.length > 0 ? options.tags : undefined,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: absoluteImageUrl ? [absoluteImageUrl] : undefined,
    },
  };

  if (options.robots) {
    metadata.robots = options.robots;
  }

  return metadata;
}
