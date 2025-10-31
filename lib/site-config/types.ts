import type { SiteConfig } from "@/config/site";

export type ResolvedSiteConfig = SiteConfig & {
  metadata: NonNullable<SiteConfig["metadata"]> & {
    keywords: string[];
  };
  comments: {
    enabled: boolean;
  };
  registration: {
    enabled: boolean;
    autoApprove: boolean;
    privacyPolicyPageSlug: string | null;
  };
  analytics: {
    googleTagManagerId: string | null;
  };
};
