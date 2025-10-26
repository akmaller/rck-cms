"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/auth";
import {
  createArticleComment,
  ensureCommentRateLimit,
} from "@/lib/comments/service";
import { getSiteConfig } from "@/lib/site-config/server";
import { commentCreateSchema } from "@/lib/validators/comment";

const USER_COMMENT_LIMIT = 10;
const USER_COMMENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const USER_ARTICLE_LIMIT = 4;
const USER_ARTICLE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

const IP_COMMENT_LIMIT = 12;
const IP_COMMENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

type CommentFormState = {
  success?: boolean;
  error?: string;
};

function extractClientIp(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .find(Boolean);
    if (first) {
      return first;
    }
  }

  const realIp = headerList.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return null;
}

export async function createCommentAction(
  articleId: string,
  slug: string,
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: "Silakan masuk atau daftar untuk memberikan komentar.",
    };
  }

  const config = await getSiteConfig();
  const commentsEnabled = config?.comments?.enabled ?? true;
  if (!commentsEnabled) {
    return {
      error: "Komentar sedang dinonaktifkan oleh administrator.",
    };
  }

  const rawContent = formData.get("content");
  const parsed = commentCreateSchema.safeParse({
    content: typeof rawContent === "string" ? rawContent : "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Komentar tidak valid.",
    };
  }

  const headerList = await headers();
  const ipAddress = extractClientIp(headerList);
  const userAgent = headerList.get("user-agent") ?? null;

  try {
    await ensureCommentRateLimit(
      `comment:user:${session.user.id}`,
      USER_COMMENT_LIMIT,
      USER_COMMENT_WINDOW_MS
    );
    await ensureCommentRateLimit(
      `comment:user-article:${session.user.id}:${articleId}`,
      USER_ARTICLE_LIMIT,
      USER_ARTICLE_WINDOW_MS
    );
    if (ipAddress) {
      await ensureCommentRateLimit(
        `comment:ip:${ipAddress}`,
        IP_COMMENT_LIMIT,
        IP_COMMENT_WINDOW_MS
      );
    }

    await createArticleComment({
      articleId,
      userId: session.user.id,
      content: parsed.data.content,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RATE_LIMITED") {
        return {
          error: "Terlalu banyak percobaan komentar dalam waktu singkat. Coba lagi sebentar lagi.",
        };
      }
      if (error.message === "TARGET_UNAVAILABLE") {
        return {
          error: "Artikel ini tidak mengizinkan komentar.",
        };
      }
      if (error.message === "COMMENTS_DISABLED") {
        return {
          error: "Komentar sedang dinonaktifkan oleh administrator.",
        };
      }
      if (error.message === "EMPTY_COMMENT") {
        return {
          error: "Komentar tidak boleh kosong.",
        };
      }
    }
    console.error("Failed to create article comment", error);
    return {
      error: "Gagal menyimpan komentar. Silakan coba lagi.",
    };
  }

  revalidatePath(`/articles/${slug}`);
  return { success: true };
}

export type { CommentFormState };
