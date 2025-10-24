import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { siteConfig as defaultSiteConfig } from "@/config/site";
import type { ConfigValues } from "@/components/forms/config-form";
import type { ResolvedSiteConfig } from "./types";

const mergeConfig = (values?: ConfigValues | null): ResolvedSiteConfig => {
  const metadata = values?.metadata ?? {};
  const social = values?.social ?? {};

  return {
    ...defaultSiteConfig,
    name: values?.siteName?.trim() || defaultSiteConfig.name,
    description:
      metadata.description?.trim() || values?.tagline?.trim() || defaultSiteConfig.description,
    tagline: values?.tagline?.trim() || defaultSiteConfig.tagline,
    logoUrl: values?.logoUrl?.trim() || defaultSiteConfig.logoUrl,
    iconUrl: values?.iconUrl?.trim() || defaultSiteConfig.iconUrl,
    contactEmail: values?.contactEmail?.trim() || defaultSiteConfig.contactEmail,
    links: {
      facebook: social.facebook?.trim() || defaultSiteConfig.links.facebook,
      instagram: social.instagram?.trim() || defaultSiteConfig.links.instagram,
      twitter: social.twitter?.trim() || defaultSiteConfig.links.twitter,
      youtube: social.youtube?.trim() || defaultSiteConfig.links.youtube,
    },
    metadata: {
      title: metadata.title?.trim() || defaultSiteConfig.metadata?.title || defaultSiteConfig.name,
      description:
        metadata.description?.trim() || defaultSiteConfig.metadata?.description || defaultSiteConfig.description,
      keywords:
        Array.isArray(metadata.keywords) && metadata.keywords.length > 0
          ? metadata.keywords.filter(Boolean)
          : defaultSiteConfig.metadata?.keywords ?? [],
    },
    ogImage: defaultSiteConfig.ogImage,
    url: defaultSiteConfig.url,
  };
};

const fetchSiteConfig = async () => {
  const record = await prisma.siteConfig.findUnique({ where: { key: "general" } });
  const value = (record?.value ?? null) as ConfigValues | null;
  return mergeConfig(value);
};

export const getSiteConfig = unstable_cache(fetchSiteConfig, ["site-config"], {
  tags: ["site-config"],
});
