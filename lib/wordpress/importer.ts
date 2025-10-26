import path from "path";

import { ArticleStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { generateExcerptFromContent, ensureUniqueArticleSlug } from "@/lib/articles/utils";
import { saveMediaFile, deleteMediaFile } from "@/lib/storage/media";
import { writeAuditLog } from "@/lib/audit/log";
import { slugify } from "@/lib/utils/slug";

export type WordpressCategory = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

export type WordpressTaxonomy = {
  id: number;
  name: string;
  slug: string;
};

export type WordpressFeaturedMedia = {
  sourceUrl: string;
  altText: string | null;
};

export type WordpressPostPayload = {
  id: number;
  title: string;
  slug: string;
  date: string;
  link: string;
  excerptText: string;
  contentHtml: string;
  categories: WordpressTaxonomy[];
  tags: WordpressTaxonomy[];
  featuredMedia: WordpressFeaturedMedia | null;
};

export type WordpressPostsResponse = {
  posts: WordpressPostPayload[];
  page: number;
  totalPages: number;
  totalItems: number;
};

type WordpressPostApiPayload = {
  id: number;
  date: string;
  slug: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      alt_text?: string | null;
    }>;
    "wp:term"?: Array<
      Array<{
        id?: number;
        name?: string;
        slug?: string;
        taxonomy?: string;
      }>
    >;
  };
};

const POSTS_PER_PAGE = 10;

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("URL WordPress tidak boleh kosong.");
  }

  const candidate = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("URL WordPress tidak valid.");
  }

  parsed.hash = "";
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = pathname;
  return parsed.toString().replace(/\/+$/, "");
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const numeric = Number(code);
      if (Number.isFinite(numeric)) {
        return String.fromCharCode(numeric);
      }
      return _;
    });
}

function stripDisallowedTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
}

function htmlToPlainText(html: string): string {
  if (!html) return "";
  const sanitized = stripDisallowedTags(html)
    .replace(/<\/(p|div|section|article|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
  return decodeBasicHtmlEntities(sanitized).replace(/\s+/g, " ").trim();
}

function convertHtmlToEditorContent(html: string): Record<string, unknown> {
  if (!html) {
    return { type: "doc", content: [] };
  }

  const sanitized = stripDisallowedTags(html)
    .replace(/<\/(p|div|section|article)>/gi, "\n\n")
    .replace(/<\/h1>/gi, "\n\n# ")
    .replace(/<\/h2>/gi, "\n\n## ")
    .replace(/<\/h3>/gi, "\n\n### ")
    .replace(/<\/h4>/gi, "\n\n#### ")
    .replace(/<\/h5>/gi, "\n\n##### ")
    .replace(/<\/h6>/gi, "\n\n###### ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/blockquote>/gi, "\n\n> ")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeBasicHtmlEntities(sanitized)
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const content = decoded.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));

  return { type: "doc", content };
}

async function ensureCategory(client: PrismaClientLike, name: string): Promise<{ id: string }> {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Kategori tidak valid dari WordPress.");
  }

  const existing = await client.category.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    await client.category.update({ where: { id: existing.id }, data: { name: normalized } });
    return { id: existing.id };
  }

  let baseSlug = slugify(normalized);
  if (!baseSlug) {
    baseSlug = `kategori-${Date.now()}`;
  }
  let candidate = baseSlug;
  let counter = 1;
  while (true) {
    const exists = await client.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) {
      break;
    }
    candidate = `${baseSlug}-${counter++}`;
  }

  const created = await client.category.create({
    data: { name: normalized, slug: candidate },
    select: { id: true },
  });

  return { id: created.id };
}

async function ensureTag(client: PrismaClientLike, name: string): Promise<{ id: string }> {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Tag tidak valid dari WordPress.");
  }

  const existing = await client.tag.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    await client.tag.update({ where: { id: existing.id }, data: { name: normalized } });
    return { id: existing.id };
  }

  let baseSlug = slugify(normalized);
  if (!baseSlug) {
    baseSlug = `tag-${Date.now()}`;
  }
  let candidate = baseSlug;
  let counter = 1;
  while (true) {
    const exists = await client.tag.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) {
      break;
    }
    candidate = `${baseSlug}-${counter++}`;
  }

  const created = await client.tag.create({
    data: { name: normalized, slug: candidate },
    select: { id: true },
  });

  return { id: created.id };
}

async function fetchJson(url: URL): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const statusText = response.statusText || "Terjadi kesalahan";
    throw new Error(`Gagal mengambil data WordPress (${response.status} ${statusText}).`);
  }

  return response;
}

export async function getWordpressCategories(siteUrl: string): Promise<WordpressCategory[]> {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  const base = new URL(`${normalizedUrl}/wp-json/wp/v2/categories`);
  base.searchParams.set("per_page", "100");
  base.searchParams.set("orderby", "name");
  base.searchParams.set("order", "asc");

  const categories: WordpressCategory[] = [];
  let page = 1;
  while (true) {
    base.searchParams.set("page", String(page));
    const response = await fetchJson(base);
    const payload = (await response.json()) as Array<{
      id?: number;
      name?: string;
      slug?: string;
      count?: number;
    }>;

    for (const item of payload) {
      if (!item?.id || !item?.name || !item?.slug) continue;
      categories.push({
        id: item.id,
        name: decodeBasicHtmlEntities(item.name),
        slug: item.slug,
        count: item.count ?? 0,
      });
    }

    const totalPages = Number(response.headers.get("X-WP-TotalPages") ?? "0");
    if (!Number.isFinite(totalPages) || totalPages === 0 || page >= totalPages) {
      break;
    }
    page += 1;
  }

  return categories;
}

function transformWordpressPost(post: WordpressPostApiPayload): WordpressPostPayload | null {
  if (!post?.id || !post?.date) {
    return null;
  }

  const titleRaw = decodeBasicHtmlEntities(post.title?.rendered ?? "Tanpa Judul").trim();
  const title = titleRaw.length > 0 ? titleRaw : "Tanpa Judul";
  const contentHtml = stripDisallowedTags(post.content?.rendered ?? "");
  const excerptHtml = post.excerpt?.rendered ?? "";
  const sanitizedSlug =
    typeof post.slug === "string" && post.slug.trim().length > 0 ? post.slug.trim() : "";

  const categories: WordpressTaxonomy[] = [];
  const tags: WordpressTaxonomy[] = [];

  const embeddedTerms = post._embedded?.["wp:term"] ?? [];
  for (const group of embeddedTerms) {
    if (!Array.isArray(group)) continue;
    for (const term of group) {
      if (!term?.name || !term?.slug || typeof term.id !== "number") continue;
      const name = decodeBasicHtmlEntities(term.name).trim();
      if (!name) continue;
      if (term.taxonomy === "category") {
        categories.push({ id: term.id, name, slug: term.slug });
      } else if (term.taxonomy === "post_tag") {
        tags.push({ id: term.id, name, slug: term.slug });
      }
    }
  }

  const featured = post._embedded?.["wp:featuredmedia"]?.[0];
  const featuredMedia: WordpressFeaturedMedia | null =
    featured?.source_url && typeof featured.source_url === "string"
      ? {
          sourceUrl: featured.source_url,
          altText: featured.alt_text ?? null,
        }
      : null;

  return {
    id: post.id,
    title,
    slug: sanitizedSlug || slugify(title) || `artikel-wordpress-${post.id}`,
    date: post.date,
    link: post.link ?? "",
    excerptText: htmlToPlainText(excerptHtml),
    contentHtml,
    categories,
    tags,
    featuredMedia,
  };
}

export async function getWordpressPostsForCategory(
  siteUrl: string,
  categoryId: number,
  page: number
): Promise<WordpressPostsResponse> {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  const endpoint = new URL(`${normalizedUrl}/wp-json/wp/v2/posts`);
  endpoint.searchParams.set("categories", String(categoryId));
  endpoint.searchParams.set("per_page", String(POSTS_PER_PAGE));
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("orderby", "date");
  endpoint.searchParams.set("order", "desc");
  endpoint.searchParams.set("_embed", "1");

  const response = await fetchJson(endpoint);
  const payload = (await response.json()) as WordpressPostApiPayload[];
  const posts = payload
    .map(transformWordpressPost)
    .filter((item): item is WordpressPostPayload => Boolean(item));

  const totalPagesHeader = Number(response.headers.get("X-WP-TotalPages") ?? "0");
  const totalItemsHeader = Number(response.headers.get("X-WP-Total") ?? "0");
  const totalPages = Number.isFinite(totalPagesHeader) ? totalPagesHeader : 0;
  const totalItems = Number.isFinite(totalItemsHeader) ? totalItemsHeader : posts.length;

  return {
    posts,
    page,
    totalPages,
    totalItems,
  };
}

function parsePublishedAt(dateString: string): Date | null {
  if (!dateString) {
    return null;
  }
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

async function downloadFeaturedImage(url: string): Promise<File | null> {
  if (!url) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";

  let fileName = "featured-image";
  try {
    const parsedUrl = new URL(url);
    const baseName = path.basename(parsedUrl.pathname);
    if (baseName) {
      fileName = baseName.split("?")[0] || fileName;
    }
  } catch {
    // ignore malformed URL path segments
  }

  return new File([arrayBuffer], fileName, { type: contentType });
}

export async function hasImportedWordpressPost(postId: number): Promise<boolean> {
  if (!Number.isFinite(postId) || postId <= 0) {
    return false;
  }

  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "ARTICLE_IMPORT_WORDPRESS",
      entity: "Article",
      metadata: {
        path: ["originalPostId"],
        equals: postId,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function importWordpressPost(params: {
  post: WordpressPostPayload;
  intent: "publish" | "draft";
  authorId: string;
}) {
  const { post, intent, authorId } = params;
  const content = convertHtmlToEditorContent(post.contentHtml);
  const excerpt = generateExcerptFromContent(content) ?? post.excerptText ?? null;
  const status = intent === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.DRAFT;
  const publishedAt = status === ArticleStatus.PUBLISHED ? parsePublishedAt(post.date) ?? new Date() : null;

  const uniqueSlug = await ensureUniqueArticleSlug(post.slug || post.title);

  let savedMedia:
    | (Awaited<ReturnType<typeof saveMediaFile>> & { title: string; description: string | null })
    | null = null;

  if (post.featuredMedia?.sourceUrl) {
    const file = await downloadFeaturedImage(post.featuredMedia.sourceUrl);
    if (file) {
      try {
        const saved = await saveMediaFile(file);
        savedMedia = {
          ...saved,
          title: post.featuredMedia.altText?.trim() || post.title,
          description: post.featuredMedia.altText?.trim() || null,
        };
      } catch (error) {
        console.error("Gagal menyimpan gambar unggulan WordPress", error);
        savedMedia = null;
      }
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let featuredMediaId: string | null = null;

      if (savedMedia) {
        const media = await tx.media.create({
          data: {
            title: savedMedia.title,
            description: savedMedia.description,
            fileName: savedMedia.fileName,
            url: savedMedia.url,
            mimeType: "image/webp",
            size: savedMedia.size,
            width: savedMedia.width,
            height: savedMedia.height,
            storageType: savedMedia.storageType,
            createdById: authorId,
          },
        });
        featuredMediaId = media.id;
      }

      const categoryIds: string[] = [];
      for (const category of post.categories) {
        const ensured = await ensureCategory(tx, category.name);
        categoryIds.push(ensured.id);
      }

      const tagIds: string[] = [];
      for (const tag of post.tags) {
        const ensured = await ensureTag(tx, tag.name);
        tagIds.push(ensured.id);
      }

      const article = await tx.article.create({
        data: {
          title: post.title,
          slug: uniqueSlug,
          excerpt,
          content: content as Prisma.InputJsonValue,
          status,
          publishedAt,
          authorId,
          featuredMediaId,
        },
      });

      if (categoryIds.length) {
        const baseDate = Date.now();
        await tx.articleCategory.createMany({
          data: categoryIds.map((categoryId, index) => ({
            articleId: article.id,
            categoryId,
            assignedAt: new Date(baseDate + index),
          })),
          skipDuplicates: true,
        });
      }

      if (tagIds.length) {
        await tx.articleTag.createMany({
          data: tagIds.map((tagId) => ({ articleId: article.id, tagId })),
          skipDuplicates: true,
        });
      }

      return { articleId: article.id, slug: article.slug, status: article.status };
    });

    await writeAuditLog({
      action: "ARTICLE_IMPORT_WORDPRESS",
      entity: "Article",
      entityId: result.articleId,
      metadata: {
        source: "wordpress",
        originalPostId: post.id,
        originalSlug: post.slug,
        importedAt: new Date().toISOString(),
      },
      userId: authorId,
    });

    return result;
  } catch (error) {
    if (savedMedia) {
      await deleteMediaFile(savedMedia.storageType, savedMedia.fileName).catch(() => {});
    }
    throw error;
  }
}
