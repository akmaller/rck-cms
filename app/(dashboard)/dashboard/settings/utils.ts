import type { ConfigValues } from "@/components/forms/config-form";

export function buildInitialConfig(value: ConfigValues | null | undefined): ConfigValues {
  return {
    siteName: value?.siteName ?? "",
    siteUrl: value?.siteUrl ?? "",
    logoUrl: value?.logoUrl ?? "",
    iconUrl: value?.iconUrl ?? "",
    tagline: value?.tagline ?? "",
    timezone: value?.timezone ?? "UTC",
    contactEmail: value?.contactEmail ?? "",
    cacheEnabled: value?.cache?.enabled ?? true,
    cache: {
      enabled: value?.cache?.enabled ?? true,
    },
    social: {
      facebook: value?.social?.facebook ?? "",
      instagram: value?.social?.instagram ?? "",
      youtube: value?.social?.youtube ?? "",
      twitter: value?.social?.twitter ?? "",
    },
    metadata: {
      title: value?.metadata?.title ?? "",
      description: value?.metadata?.description ?? "",
      keywords: value?.metadata?.keywords ?? [],
    },
    registration: {
      enabled: value?.registration?.enabled ?? true,
      autoApprove: value?.registration?.autoApprove ?? false,
      privacyPolicyPageSlug: value?.registration?.privacyPolicyPageSlug ?? "",
    },
    comments: {
      enabled: value?.comments?.enabled ?? true,
    },
    analytics: {
      googleTagManagerId: value?.analytics?.googleTagManagerId ?? "",
    },
  };
}
