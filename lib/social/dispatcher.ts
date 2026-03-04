import { ArticleStatus } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { postToFacebookPage, postToInstagram, postToX } from "@/lib/social/adapters";
import { getSocialCredentialsSafe } from "@/lib/social/accounts";
import { buildArticleUrl } from "@/lib/social/article-url";
import { buildInstagramShareImageApiUrl } from "@/lib/social/instagram-media";
import { getSiteConfigUncached } from "@/lib/site-config/server";
import type { ResolvedSiteConfig } from "@/lib/site-config/types";

const JOB_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  POSTED: "POSTED",
  FAILED: "FAILED",
} as const;

const PLATFORM = {
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  TWITTER: "TWITTER",
} as const;

type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];
type Channel = "facebook" | "instagram" | "twitter";
type Credentials = Awaited<ReturnType<typeof getSocialCredentialsSafe>>;

type SocialPostJobRow = {
  id: string;
  platform: Platform;
  articleId: string;
  status: JobStatus;
  retryCount: number;
  error: string | null;
  postedAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

type SocialPostJobStore = {
  findMany(args: {
    where: {
      status: { in: JobStatus[] };
      retryCount: { lt: number };
    };
    orderBy: { createdAt: "asc" };
    take: number;
  }): Promise<SocialPostJobRow[]>;
  updateMany(args: {
    where: { id: string; status: JobStatus };
    data: { status: JobStatus; error?: string | null };
  }): Promise<{ count: number }>;
  update(args: {
    where: { id: string };
    data: {
      status?: JobStatus;
      error?: string | null;
      retryCount?: { increment: number };
      postedAt?: Date | null;
    };
  }): Promise<unknown>;
};

function socialPostJobStore(): SocialPostJobStore {
  return (prisma as unknown as { socialPostJob: SocialPostJobStore }).socialPostJob;
}

function mapPlatformToChannel(platform: Platform): Channel {
  if (platform === PLATFORM.FACEBOOK) {
    return "facebook";
  }
  if (platform === PLATFORM.INSTAGRAM) {
    return "instagram";
  }
  return "twitter";
}

function isRetryDue(job: SocialPostJobRow, now: Date) {
  if (job.status === JOB_STATUS.PENDING) {
    return true;
  }

  const backoffSeconds = Math.min(60 * Math.pow(2, Math.max(0, job.retryCount - 1)), 3600);
  const nextAttemptAt = new Date(job.updatedAt.getTime() + backoffSeconds * 1000);
  return nextAttemptAt.getTime() <= now.getTime();
}

function isPlatformEnabled(siteConfig: ResolvedSiteConfig, platform: Platform) {
  if (!siteConfig.socialAutopost.enabled) {
    return false;
  }
  if (platform === PLATFORM.FACEBOOK) {
    return siteConfig.socialAutopost.facebook.enabled;
  }
  if (platform === PLATFORM.INSTAGRAM) {
    return siteConfig.socialAutopost.instagram.enabled;
  }
  return siteConfig.socialAutopost.twitter.enabled;
}

async function processSingleJob(
  job: SocialPostJobRow,
  context: {
    siteConfig: ResolvedSiteConfig;
    credentials: Credentials;
  }
) {
  const { siteConfig, credentials } = context;
  const article = await prisma.article.findUnique({
    where: { id: job.articleId },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      status: true,
    },
  });

  if (!article || article.status !== ArticleStatus.PUBLISHED || !article.slug) {
    throw new Error("Artikel tidak tersedia untuk auto-post");
  }

  if (!isPlatformEnabled(siteConfig, job.platform)) {
    throw new Error("Auto-post platform sedang nonaktif");
  }

  const articleUrl = buildArticleUrl(siteConfig.url, article.slug);
  const channel = mapPlatformToChannel(job.platform);
  const payload = {
    title: article.title,
    excerpt: article.excerpt,
    articleUrl,
    instagramImageUrl: buildInstagramShareImageApiUrl({
      siteUrl: siteConfig.url,
      slug: article.slug,
      articleUrl,
    }),
  };

  if (channel === "facebook") {
    const pageId = credentials.facebook.pageId?.trim();
    const pageAccessToken = credentials.facebook.pageAccessToken?.trim();
    if (!pageId || !pageAccessToken) {
      throw new Error("Kredensial Facebook belum lengkap");
    }
    await postToFacebookPage(payload, { pageId, pageAccessToken });
  } else if (channel === "instagram") {
    const igUserId = credentials.instagram.igUserId?.trim();
    const pageAccessToken = credentials.instagram.pageAccessToken?.trim();
    if (!igUserId || !pageAccessToken) {
      throw new Error("Kredensial Instagram belum lengkap");
    }
    await postToInstagram(payload, { igUserId, pageAccessToken });
  } else {
    const accessToken = credentials.twitter.accessToken?.trim();
    if (!accessToken) {
      throw new Error("Access token X/Twitter belum diisi");
    }
    await postToX(payload, { accessToken });
  }

  await writeAuditLog({
    action: "SOCIAL_AUTOPUBLISH",
    entity: "Article",
    entityId: article.id,
    metadata: {
      jobId: job.id,
      channel,
      status: "posted",
      idempotencyKey: job.idempotencyKey,
    },
  });
}

export type SocialDispatchResult = {
  scanned: number;
  claimed: number;
  posted: number;
  failed: number;
  skipped: number;
};

export async function dispatchSocialPostJobs(options?: {
  limit?: number;
  maxRetryCount?: number;
}): Promise<SocialDispatchResult> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const maxRetryCount = Math.min(Math.max(options?.maxRetryCount ?? 5, 1), 10);
  const store = socialPostJobStore();
  const now = new Date();

  const [siteConfig, credentials, jobs] = await Promise.all([
    getSiteConfigUncached(),
    getSocialCredentialsSafe(),
    store.findMany({
      where: {
        status: { in: [JOB_STATUS.PENDING, JOB_STATUS.FAILED] },
        retryCount: { lt: maxRetryCount },
      },
      orderBy: { createdAt: "asc" },
      take: limit * 3,
    }),
  ]);

  let claimed = 0;
  let posted = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (claimed >= limit) {
      break;
    }

    if (!isRetryDue(job, now)) {
      skipped += 1;
      continue;
    }

    if (!isPlatformEnabled(siteConfig, job.platform)) {
      skipped += 1;
      continue;
    }

    const claim = await store.updateMany({
      where: { id: job.id, status: job.status },
      data: {
        status: JOB_STATUS.PROCESSING,
        error: null,
      },
    });

    if (claim.count === 0) {
      skipped += 1;
      continue;
    }

    claimed += 1;

    try {
      await processSingleJob(job, { siteConfig, credentials });
      await store.update({
        where: { id: job.id },
        data: {
          status: JOB_STATUS.POSTED,
          postedAt: new Date(),
          error: null,
        },
      });
      posted += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Gagal memproses social post job";
      await store.update({
        where: { id: job.id },
        data: {
          status: JOB_STATUS.FAILED,
          retryCount: { increment: 1 },
          error: detail.slice(0, 2000),
        },
      });
      failed += 1;
    }
  }

  return {
    scanned: jobs.length,
    claimed,
    posted,
    failed,
    skipped,
  };
}
