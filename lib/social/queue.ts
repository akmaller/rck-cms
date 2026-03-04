import { ArticleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";

const PLATFORM = {
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  TWITTER: "TWITTER",
} as const;

type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];

type SocialPostJobStore = {
  createMany(args: {
    data: Array<{
      platform: Platform;
      articleId: string;
      status: "PENDING";
      retryCount: number;
      idempotencyKey: string;
    }>;
    skipDuplicates: boolean;
  }): Promise<{ count: number }>;
};

function socialPostJobStore(): SocialPostJobStore {
  return (prisma as unknown as { socialPostJob: SocialPostJobStore }).socialPostJob;
}

function buildIdempotencyKey(articleId: string, platform: Platform, publishedAt: Date) {
  return `${articleId}:${platform}:${publishedAt.toISOString()}`;
}

function resolveEnabledPlatforms(config: Awaited<ReturnType<typeof getSiteConfig>>): Platform[] {
  if (!config.socialAutopost?.enabled) {
    return [];
  }

  const platforms: Platform[] = [];
  if (config.socialAutopost.facebook.enabled) {
    platforms.push(PLATFORM.FACEBOOK);
  }
  if (config.socialAutopost.instagram.enabled) {
    platforms.push(PLATFORM.INSTAGRAM);
  }
  if (config.socialAutopost.twitter.enabled) {
    platforms.push(PLATFORM.TWITTER);
  }

  return platforms;
}

export async function enqueueSocialPostJobsForArticle(articleId: string) {
  const [config, article] = await Promise.all([
    getSiteConfig(),
    prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true, publishedAt: true },
    }),
  ]);

  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    return { count: 0 };
  }

  const platforms = resolveEnabledPlatforms(config);
  if (platforms.length === 0) {
    return { count: 0 };
  }

  const publishedAt = article.publishedAt ?? new Date();
  const data = platforms.map((platform) => ({
    platform,
    articleId: article.id,
    status: "PENDING" as const,
    retryCount: 0,
    idempotencyKey: buildIdempotencyKey(article.id, platform, publishedAt),
  }));

  const store = socialPostJobStore();
  return store.createMany({
    data,
    skipDuplicates: true,
  });
}
