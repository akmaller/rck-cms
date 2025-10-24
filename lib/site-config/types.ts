import type { SiteConfig } from "@/config/site";

export type ResolvedSiteConfig = SiteConfig & {
  metadata: NonNullable<SiteConfig["metadata"]> & {
    keywords: string[];
  };
};
