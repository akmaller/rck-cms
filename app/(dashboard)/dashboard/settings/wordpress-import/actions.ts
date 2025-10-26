"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import {
  getWordpressCategories,
  getWordpressPostsForCategory,
  importWordpressPost,
  type WordpressCategory,
  type WordpressPostPayload,
} from "@/lib/wordpress/importer";

const siteUrlSchema = z.string().min(1, "URL WordPress wajib diisi");

const taxonomySchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  slug: z.string().min(1),
});

const featuredMediaSchema = z
  .object({
    sourceUrl: z.string().url(),
    altText: z.string().nullable(),
  })
  .nullable();

const wordpressPostSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  slug: z.string().min(1),
  date: z.string().min(1),
  link: z.string().optional().default(""),
  excerptText: z.string().optional().default(""),
  contentHtml: z.string().min(1),
  categories: z.array(taxonomySchema),
  tags: z.array(taxonomySchema),
  featuredMedia: featuredMediaSchema,
});

export async function fetchWordpressCategoriesAction(siteUrl: string): Promise<
  | { success: true; categories: WordpressCategory[] }
  | { success: false; message: string }
> {
  try {
    await assertRole("ADMIN");
    const parsedUrl = siteUrlSchema.safeParse(siteUrl);
    if (!parsedUrl.success) {
      return { success: false, message: parsedUrl.error.issues[0]?.message ?? "URL WordPress tidak valid" };
    }

    const categories = await getWordpressCategories(parsedUrl.data);
    if (categories.length === 0) {
      return {
        success: true,
        categories: [],
      };
    }

    return { success: true, categories };
  } catch (error) {
    console.error("fetchWordpressCategoriesAction", error);
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengambil kategori WordPress" };
  }
}

export async function fetchWordpressPostsAction(params: {
  siteUrl: string;
  categoryId: number;
  page?: number;
}): Promise<
  | {
      success: true;
      data: {
        posts: WordpressPostPayload[];
        page: number;
        totalPages: number;
        totalItems: number;
      };
    }
  | { success: false; message: string }
> {
  try {
    await assertRole("ADMIN");
    const parsedUrl = siteUrlSchema.safeParse(params.siteUrl);
    if (!parsedUrl.success) {
      return { success: false, message: parsedUrl.error.issues[0]?.message ?? "URL WordPress tidak valid" };
    }

    if (!Number.isFinite(params.categoryId) || params.categoryId <= 0) {
      return { success: false, message: "Kategori WordPress tidak valid" };
    }

    const page = params.page && params.page > 0 ? params.page : 1;
    const result = await getWordpressPostsForCategory(parsedUrl.data, params.categoryId, page);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("fetchWordpressPostsAction", error);
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengambil postingan WordPress" };
  }
}

export async function importWordpressPostAction(input: {
  siteUrl: string;
  post: WordpressPostPayload;
  intent: "publish" | "draft";
}): Promise<
  | {
      success: true;
      data: { articleId: string; slug: string; status: string };
    }
  | { success: false; message: string }
> {
  try {
    const session = await assertRole("ADMIN");

    const parsedUrl = siteUrlSchema.safeParse(input.siteUrl);
    if (!parsedUrl.success) {
      return { success: false, message: parsedUrl.error.issues[0]?.message ?? "URL WordPress tidak valid" };
    }

    const parsedPost = wordpressPostSchema.safeParse(input.post);
    if (!parsedPost.success) {
      return {
        success: false,
        message: parsedPost.error.issues[0]?.message ?? "Data postingan WordPress tidak valid",
      };
    }

    const intent = input.intent === "publish" ? "publish" : "draft";
    const created = await importWordpressPost({
      post: parsedPost.data,
      intent,
      authorId: session.user.id,
    });

    revalidateTag("content");
    revalidatePath("/dashboard/articles");

    return {
      success: true,
      data: { articleId: created.articleId, slug: created.slug, status: created.status },
    };
  } catch (error) {
    console.error("importWordpressPostAction", error);
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengimpor postingan WordPress" };
  }
}
