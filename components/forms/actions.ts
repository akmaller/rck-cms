"use server";

import { ArticleStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { assertRole, assertArticleOwnership } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils/slug";
import { generateExcerptFromContent, ensureUniqueArticleSlug, extractPlainText } from "@/lib/articles/utils";
import { menuItemCreateSchema } from "@/lib/validators/menu";
import { pageCreateSchema, pageUpdateSchema } from "@/lib/validators/page";
import { siteConfigSchema, type SiteConfigInput } from "@/lib/validators/config";
import { writeAuditLog } from "@/lib/audit/log";
import { revalidatePath, revalidateTag } from "next/cache";
import { findForbiddenPhraseInInputs } from "@/lib/moderation/forbidden-terms";

const EMPTY_TIPTAP_DOC = { type: "doc", content: [] } as const;
const bulkArticleStatusSchema = z.object({
  articleIds: z.array(z.string().cuid()).min(1, "Pilih setidaknya satu artikel."),
  intent: z.enum(["publish", "draft"]),
});

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

function normalizeTagNames(value: FormDataEntryValue | null | undefined): string[] {
  if (!value || typeof value !== "string") {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );
}

function normalizeCategoryNames(value: FormDataEntryValue | null | undefined): string[] {
  if (!value || typeof value !== "string") {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((category) => category.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );
}

function mergeSiteConfigValues(
  current: SiteConfigInput | null | undefined,
  updates: SiteConfigInput
): SiteConfigInput {
  const result: SiteConfigInput = { ...(current ?? {}) };

  if (updates.siteName !== undefined) result.siteName = updates.siteName;
  if (updates.siteUrl !== undefined) result.siteUrl = updates.siteUrl;
  if (updates.logoUrl !== undefined) result.logoUrl = updates.logoUrl;
  if (updates.iconUrl !== undefined) result.iconUrl = updates.iconUrl;
  if (updates.tagline !== undefined) result.tagline = updates.tagline;
  if (updates.timezone !== undefined) result.timezone = updates.timezone;
  if (updates.contactEmail !== undefined) result.contactEmail = updates.contactEmail;

  if (updates.social) {
    result.social = { ...(current?.social ?? {}), ...updates.social };
  }

  if (updates.metadata) {
    result.metadata = { ...(current?.metadata ?? {}), ...updates.metadata };
  }

  if (updates.registration) {
    result.registration = { ...(current?.registration ?? {}), ...updates.registration };
  }

  if (updates.analytics) {
    result.analytics = { ...(current?.analytics ?? {}), ...updates.analytics };
  }

  if (updates.comments) {
    result.comments = { ...(current?.comments ?? {}), ...updates.comments };
  }

  if (updates.cache) {
    result.cache = { ...(current?.cache ?? {}), ...updates.cache };
  }

  return result;
}

async function ensureTag(client: PrismaClientLike, name: string): Promise<{ id: string }> {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Tag tidak valid");
  }

  const existingByName = await client.tag.findFirst({
    where: {
      name: {
        equals: normalized,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingByName) {
    await client.tag.update({ where: { id: existingByName.id }, data: { name: normalized } });
    return { id: existingByName.id };
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

async function ensureCategory(client: PrismaClientLike, name: string): Promise<{ id: string }> {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Kategori tidak valid");
  }

  const existingByName = await client.category.findFirst({
    where: {
      name: {
        equals: normalized,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingByName) {
    await client.category.update({ where: { id: existingByName.id }, data: { name: normalized } });
    return { id: existingByName.id };
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

const articleFormSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter"),
  slug: z.string().optional(),
  excerpt: z
    .string()
    .optional()
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  content: z.string().transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (typeof parsed !== "object" || !parsed) {
        throw new Error("Konten tidak valid");
      }
      return parsed;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Konten tidak valid" });
      return z.NEVER;
    }
  }),
  featuredMediaId: z.string().cuid().nullable().optional(),
});

const articleUpdateFormSchema = articleFormSchema.extend({
  articleId: z.string().cuid(),
});

export async function createArticle(formData: FormData) {
  try {
    const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

    if (session.user.role === "AUTHOR") {
      const author = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
      if (!author?.canPublish) {
        return {
          error: "Akun penulis Anda menunggu persetujuan admin sebelum dapat menulis artikel.",
        };
      }
    }

    const rawExcerpt = formData.get("excerpt");
    const parsed = articleFormSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      excerpt: typeof rawExcerpt === "string" ? rawExcerpt : undefined,
      content: formData.get("content") || JSON.stringify(EMPTY_TIPTAP_DOC),
      featuredMediaId: (formData.get("featuredMediaId") || null) as string | null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    }

    const contentPlainText = extractPlainText(parsed.data.content as Record<string, unknown>);
    const forbiddenMatch = await findForbiddenPhraseInInputs([
      parsed.data.title,
      parsed.data.excerpt ?? null,
      contentPlainText,
    ]);
    if (forbiddenMatch) {
      return {
        error: `Konten mengandung kata/kalimat terlarang "${forbiddenMatch.phrase}". Hapus kata tersebut sebelum melanjutkan.`,
      };
    }

    const intentRaw = formData.get("intent");
    const intent = typeof intentRaw === "string" && intentRaw === "publish" ? "publish" : "draft";
    const targetStatus = intent === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.DRAFT;
    const targetPublishedAt = targetStatus === ArticleStatus.PUBLISHED ? new Date() : null;

    const tagNames = normalizeTagNames(formData.get("tags"));
    const categoryNames = normalizeCategoryNames(formData.get("categories"));
    const uniqueSlug = await ensureUniqueArticleSlug(parsed.data.slug ?? parsed.data.title);
    const generatedExcerpt =
      generateExcerptFromContent(parsed.data.content as Record<string, unknown>) ?? null;

    const article = await prisma.$transaction(async (tx) => {
      const categoryIds: string[] = [];
      for (const categoryName of categoryNames) {
        const category = await ensureCategory(tx, categoryName);
        categoryIds.push(category.id);
      }

      const tagIds: string[] = [];
      for (const tagName of tagNames) {
        const tag = await ensureTag(tx, tagName);
        tagIds.push(tag.id);
      }

      const created = await tx.article.create({
        data: {
          title: parsed.data.title,
          slug: uniqueSlug,
          excerpt: generatedExcerpt,
          content: parsed.data.content as Prisma.InputJsonValue,
          status: targetStatus,
          publishedAt: targetPublishedAt,
          authorId: session.user.id,
          featuredMediaId: parsed.data.featuredMediaId ?? null,
        },
      });

      if (categoryIds.length) {
        const baseTime = Date.now();
        await tx.articleCategory.deleteMany({ where: { articleId: created.id } });
        await tx.articleCategory.createMany({
          data: categoryIds.map((categoryId, index) => ({
            articleId: created.id,
            categoryId,
            assignedAt: new Date(baseTime + index),
          })),
          skipDuplicates: true,
        });
      }

      if (tagIds.length) {
        await tx.articleTag.createMany({
          data: tagIds.map((tagId) => ({ articleId: created.id, tagId })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await writeAuditLog({
      action: "ARTICLE_CREATE",
      entity: "Article",
      entityId: article.id,
      metadata: {
        title: parsed.data.title,
        featuredMediaId: parsed.data.featuredMediaId ?? null,
        status: targetStatus,
      },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/articles");

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Terjadi kesalahan saat membuat artikel" };
  }
}

const categoryFormSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  slug: z.string().optional(),
  description: z.string().max(500).optional(),
});

const categoryUpdateSchema = categoryFormSchema.extend({
  id: z.string().cuid(),
});

export async function createCategory(formData: FormData) {
  try {
    await assertRole(["EDITOR", "ADMIN"]);

    const parsed = categoryFormSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug") || undefined,
      description: formData.get("description") || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data kategori tidak valid" };
    }

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.name);
    const safeBase = baseSlug.length > 0 ? baseSlug : `kategori-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const exists = await prisma.category.findUnique({ where: { slug: candidate } });
      if (!exists) break;
      candidate = `${safeBase}-${counter++}`;
    }

    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        slug: candidate,
        description: parsed.data.description,
      },
    });

    await writeAuditLog({
      action: "CATEGORY_CREATE",
      entity: "Category",
      entityId: category.id,
      metadata: { name: parsed.data.name },
    });

    revalidateTag("content");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal membuat kategori" };
  }
}

export async function updateCategory(formData: FormData) {
  try {
    await assertRole(["EDITOR", "ADMIN"]);

    const parsed = categoryUpdateSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name") || undefined,
      slug: formData.get("slug") || undefined,
      description: formData.get("description") || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data kategori tidak valid" };
    }

    const category = await prisma.category.findUnique({ where: { id: parsed.data.id } });
    if (!category) {
      return { error: "Kategori tidak ditemukan" };
    }

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.name ?? category.name);
    const safeBase = baseSlug.length > 0 ? baseSlug : `kategori-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const exists = await prisma.category.findUnique({ where: { slug: candidate } });
      if (!exists || exists.id === category.id) break;
      candidate = `${safeBase}-${counter++}`;
    }

    const updated = await prisma.category.update({
      where: { id: category.id },
      data: {
        name: parsed.data.name,
        slug: candidate,
        description: parsed.data.description ?? null,
      },
      select: { id: true, name: true, slug: true, description: true, _count: { select: { articles: true } }, createdAt: true },
    });

    await writeAuditLog({
      action: "CATEGORY_UPDATE",
      entity: "Category",
      entityId: category.id,
      metadata: { name: parsed.data.name },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/taxonomies");
    return { success: true, data: updated };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui kategori" };
  }
}

export async function deleteCategory(id: string) {
  try {
    await assertRole(["EDITOR", "ADMIN"]);

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return { error: "Kategori tidak ditemukan" };
    }

    await prisma.category.delete({ where: { id } });

    await writeAuditLog({
      action: "CATEGORY_DELETE",
      entity: "Category",
      entityId: id,
      metadata: { name: category.name },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/taxonomies");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal menghapus kategori" };
  }
}


const userFormSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.enum(["ADMIN", "EDITOR", "AUTHOR"]),
});

export async function createUser(formData: FormData) {
  try {
    await assertRole("ADMIN");

    const parsed = userFormSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data pengguna tidak valid" };
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return { error: "Email sudah digunakan" };
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
      },
    });

    await writeAuditLog({
      action: "USER_CREATE",
      entity: "User",
      entityId: user.id,
      metadata: { email: parsed.data.email, role: parsed.data.role },
    });

    revalidateTag("content");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal membuat pengguna" };
  }
}

function sanitizeCategorySlug(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const ALLOWED_MENU_URL_SCHEMES = new Set(["http", "https", "mailto", "tel", "sms"]);

function normalizeUrl(value: string | undefined | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    return trimmed.replace(/\/{2,}/g, "/");
  }
  const scheme = trimmed.split(":")[0]?.toLowerCase();
  if (!scheme) {
    return null;
  }
  if (!ALLOWED_MENU_URL_SCHEMES.has(scheme)) {
    return null;
  }
  if (scheme === "http" || scheme === "https") {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }
  return trimmed;
}

export async function createMenuItemAction(formData: FormData) {
  try {
    await assertRole("ADMIN");

    const parsed = menuItemCreateSchema.safeParse({
      menu: formData.get("menu"),
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      url: formData.get("url") || undefined,
      icon: formData.get("icon") || undefined,
      order: formData.get("order") ? Number(formData.get("order")) : undefined,
      parentId: formData.get("parentId") ? String(formData.get("parentId")) : null,
      pageId: formData.get("pageId") ? String(formData.get("pageId")) : null,
      isExternal: formData.get("isExternal") === "on",
      categorySlug: sanitizeCategorySlug(formData.get("categorySlug")),
      albumId: formData.get("albumId") ? String(formData.get("albumId")) : null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data menu tidak valid" };
    }

    if (parsed.data.url && parsed.data.pageId) {
      return { error: "Gunakan URL atau tautan halaman, bukan keduanya" };
    }

    if (parsed.data.categorySlug && parsed.data.pageId) {
      return { error: "Gunakan halaman atau kategori, bukan keduanya" };
    }

    if (parsed.data.categorySlug && parsed.data.url) {
      return { error: "Gunakan kategori tanpa URL kustom" };
    }

    if (parsed.data.albumId && parsed.data.pageId) {
      return { error: "Gunakan album atau halaman, bukan keduanya" };
    }

    if (parsed.data.albumId && parsed.data.categorySlug) {
      return { error: "Gunakan album atau kategori, bukan keduanya" };
    }

    if (parsed.data.albumId && parsed.data.url) {
      return { error: "Gunakan album tanpa URL kustom" };
    }

    if (parsed.data.parentId) {
      const parent = await prisma.menuItem.findUnique({ where: { id: parsed.data.parentId } });
      if (!parent || parent.menu !== parsed.data.menu) {
        return { error: "Parent menu harus berada dalam menu yang sama" };
      }
    }

    let pageId: string | null = parsed.data.pageId ?? null;
    let targetSlug: string | null = null;
    let targetUrl: string | null = null;
    let isExternal = parsed.data.isExternal || false;

    if (pageId) {
      const page = await prisma.page.findUnique({ where: { id: pageId } });
      if (!page) {
        return { error: "Halaman tidak ditemukan" };
      }
      targetSlug = `pages/${page.slug}`;
      targetUrl = null;
      pageId = page.id;
      isExternal = false;
    } else if (parsed.data.categorySlug) {
      const category = await prisma.category.findUnique({ where: { slug: parsed.data.categorySlug } });
      if (!category) {
        return { error: "Kategori tidak ditemukan" };
      }
      targetSlug = `categories/${category.slug}`;
      targetUrl = null;
      pageId = null;
      isExternal = false;
    } else if (parsed.data.albumId) {
      const album = await prisma.album.findFirst({
        where: { id: parsed.data.albumId, status: ArticleStatus.PUBLISHED },
      });
      if (!album) {
        return { error: "Album tidak ditemukan atau belum dipublikasikan" };
      }
      targetSlug = `albums/${album.id}`;
      targetUrl = null;
      pageId = null;
      isExternal = false;
    } else {
      const manualUrl = normalizeUrl(parsed.data.url);
      const manualSlugInput = parsed.data.slug ? slugify(parsed.data.slug) : "";
      const baseTitleSlug = slugify(parsed.data.title);

      if (manualUrl) {
        targetUrl = manualUrl;
      }

      if (manualSlugInput) {
        const base = manualSlugInput;
        let candidate = base;
        let counter = 1;
        while (
          await prisma.menuItem.findFirst({
            where: { menu: parsed.data.menu, slug: candidate },
          })
        ) {
          candidate = `${base}-${counter++}`;
        }
        targetSlug = candidate;
      } else if (!targetUrl) {
        const base = baseTitleSlug || `menu-${Date.now()}`;
        let candidate = base;
        let counter = 1;
        while (
          await prisma.menuItem.findFirst({
            where: { menu: parsed.data.menu, slug: candidate },
          })
        ) {
          candidate = `${base}-${counter++}`;
        }
        targetSlug = candidate;
      }

      if (targetUrl) {
        isExternal = !targetUrl.startsWith("/");
      } else {
        isExternal = false;
      }
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        menu: parsed.data.menu,
        title: parsed.data.title,
        slug: targetSlug,
        url: targetUrl,
        icon: parsed.data.icon,
        order: parsed.data.order ?? 0,
        parentId: parsed.data.parentId ?? null,
        pageId,
        isExternal,
      },
    });

    await writeAuditLog({
      action: "MENU_ITEM_CREATE",
      entity: "MenuItem",
      entityId: menuItem.id,
      metadata: { menu: parsed.data.menu, title: parsed.data.title },
    });

    revalidatePath(`/dashboard/menus?menu=${parsed.data.menu}`);

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal membuat menu item" };
  }
}

export async function updateSiteConfig(formData: FormData) {
  try {
    await assertRole(["EDITOR", "ADMIN"]);

    const sanitize = (value: FormDataEntryValue | null) => {
      if (!value) return undefined;
      const text = value.toString().trim();
      return text.length > 0 ? text : undefined;
    };

    const keywordsInput = sanitize(formData.get("metadata.keywords"));
    const keywords = keywordsInput
      ? keywordsInput
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean)
      : undefined;

    const data: SiteConfigInput = {};

    const siteName = sanitize(formData.get("siteName"));
    if (siteName !== undefined) data.siteName = siteName;

    const siteUrl = sanitize(formData.get("siteUrl"));
    if (siteUrl !== undefined) data.siteUrl = siteUrl;

    const logoUrl = sanitize(formData.get("logoUrl"));
    if (logoUrl !== undefined) data.logoUrl = logoUrl;

    const iconUrl = sanitize(formData.get("iconUrl"));
    if (iconUrl !== undefined) data.iconUrl = iconUrl;

    const tagline = sanitize(formData.get("tagline"));
    if (tagline !== undefined) data.tagline = tagline;

    const timezone = sanitize(formData.get("timezone"));
    if (timezone !== undefined) data.timezone = timezone;

    const contactEmail = sanitize(formData.get("contactEmail"));
    if (contactEmail !== undefined) data.contactEmail = contactEmail;

    const socialValues: NonNullable<SiteConfigInput["social"]> = {};
    const socialFacebook = sanitize(formData.get("social.facebook"));
    if (socialFacebook !== undefined) socialValues.facebook = socialFacebook;
    const socialInstagram = sanitize(formData.get("social.instagram"));
    if (socialInstagram !== undefined) socialValues.instagram = socialInstagram;
    const socialYoutube = sanitize(formData.get("social.youtube"));
    if (socialYoutube !== undefined) socialValues.youtube = socialYoutube;
    const socialTwitter = sanitize(formData.get("social.twitter"));
    if (socialTwitter !== undefined) socialValues.twitter = socialTwitter;
    if (Object.keys(socialValues).length > 0) {
      data.social = socialValues;
    }

    const metadataValues: NonNullable<SiteConfigInput["metadata"]> = {};
    const metadataTitle = sanitize(formData.get("metadata.title"));
    if (metadataTitle !== undefined) metadataValues.title = metadataTitle;
    const metadataDescription = sanitize(formData.get("metadata.description"));
    if (metadataDescription !== undefined) metadataValues.description = metadataDescription;
    if (keywords !== undefined && keywords.length > 0) {
      metadataValues.keywords = keywords;
    }
    if (Object.keys(metadataValues).length > 0) {
      data.metadata = metadataValues;
    }

    const analyticsValues: NonNullable<SiteConfigInput["analytics"]> = {};
    const analyticsGtmRaw = formData.get("analytics.googleTagManagerId");
    if (analyticsGtmRaw !== null) {
      const text = analyticsGtmRaw.toString().trim();
      analyticsValues.googleTagManagerId = text.length > 0 ? text : null;
    }
    if (Object.keys(analyticsValues).length > 0) {
      data.analytics = analyticsValues;
    }

    const registrationValues: NonNullable<SiteConfigInput["registration"]> = {};
    const registrationEnabledValues = formData.getAll("registration.enabled").map(String);
    if (registrationEnabledValues.length > 0) {
      registrationValues.enabled = registrationEnabledValues.includes("true") || registrationEnabledValues.includes("on");
    }
    const registrationAutoApproveValues = formData.getAll("registration.autoApprove").map(String);
    if (registrationAutoApproveValues.length > 0) {
      registrationValues.autoApprove =
        registrationAutoApproveValues.includes("true") || registrationAutoApproveValues.includes("on");
    }
    const privacyPolicySlugRaw = formData.get("registration.privacyPolicyPageSlug");
    if (privacyPolicySlugRaw !== null) {
      const text = privacyPolicySlugRaw.toString().trim();
      registrationValues.privacyPolicyPageSlug = text.length > 0 ? text : null;
    }
    if (Object.keys(registrationValues).length > 0) {
      data.registration = registrationValues;
    }

    const commentsValues: NonNullable<SiteConfigInput["comments"]> = {};
    const commentsEnabledValues = formData.getAll("comments.enabled").map(String);
    if (commentsEnabledValues.length > 0) {
      commentsValues.enabled =
        commentsEnabledValues.includes("true") || commentsEnabledValues.includes("on");
    }
    if (Object.keys(commentsValues).length > 0) {
      data.comments = commentsValues;
    }

    const cacheValues = formData.getAll("cacheEnabled").map(String);
    if (cacheValues.length > 0) {
      const enabled = cacheValues.includes("true") || cacheValues.includes("on");
      data.cache = { enabled };
    }

    const parsed = siteConfigSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data konfigurasi tidak valid" };
    }

    const existingRecord = await prisma.siteConfig.findUnique({ where: { key: "general" } });
    const existingValue = (existingRecord?.value ?? null) as SiteConfigInput | null;
    const mergedValue = mergeSiteConfigValues(existingValue, parsed.data);
    const validatedValue = siteConfigSchema.parse(mergedValue);

    const config = await prisma.siteConfig.upsert({
      where: { key: "general" },
      update: { value: validatedValue },
      create: { key: "general", value: validatedValue },
    });

    await writeAuditLog({
      action: "CONFIG_UPDATE",
      entity: "SiteConfig",
      entityId: config.id,
      metadata: validatedValue,
    });

    revalidateTag("site-config");
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath("/dashboard");
    revalidatePath("/login");
    revalidatePath("/login/2fa");
    revalidatePath("/sitemap.xml");
    revalidatePath("/rss.xml");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/general");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui konfigurasi" };
  }
}

export async function createPage(formData: FormData) {
  try {
    const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

    let parsedContent = EMPTY_TIPTAP_DOC;
    const rawContent = formData.get("content");
    if (typeof rawContent === "string" && rawContent.trim()) {
      try {
        parsedContent = JSON.parse(rawContent);
      } catch {
        return { error: "Konten tidak valid" };
      }
    }

    const rawFeaturedMediaId = formData.get("featuredMediaId");
    const featuredMediaId =
      typeof rawFeaturedMediaId === "string" && rawFeaturedMediaId.trim() && rawFeaturedMediaId !== "__REMOVE__"
        ? rawFeaturedMediaId
        : undefined;

    const intentRaw = formData.get("intent");
    const intent = typeof intentRaw === "string" && intentRaw === "publish" ? "publish" : "draft";
    const targetStatus = intent === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.DRAFT;
    const targetPublishedAt = targetStatus === ArticleStatus.PUBLISHED ? new Date() : null;

    const parsed = pageCreateSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      excerpt: formData.get("excerpt") || undefined,
      content: parsedContent,
      featuredMediaId,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data halaman tidak valid" };
    }

    const contentPlainText = extractPlainText(parsed.data.content as Record<string, unknown>);
    const forbiddenMatch = await findForbiddenPhraseInInputs([
      parsed.data.title,
      parsed.data.excerpt ?? null,
      contentPlainText,
    ]);
    if (forbiddenMatch) {
      return {
        error: `Konten mengandung kata/kalimat terlarang "${forbiddenMatch.phrase}". Hapus kata tersebut sebelum melanjutkan.`,
      };
    }

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.title);
    const safeBase = baseSlug.length > 0 ? baseSlug : `halaman-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const exists = await prisma.page.findUnique({ where: { slug: candidate } });
      if (!exists) break;
      candidate = `${safeBase}-${counter++}`;
    }

    const page = await prisma.page.create({
      data: {
        title: parsed.data.title,
        slug: candidate,
        excerpt: parsed.data.excerpt,
        content: parsed.data.content as Prisma.InputJsonValue,
        status: targetStatus,
        publishedAt: targetPublishedAt,
        author: { connect: { id: session.user.id } },
        featuredMedia: featuredMediaId
          ? { connect: { id: featuredMediaId } }
          : undefined,
      },
    });

    await writeAuditLog({
      action: "PAGE_CREATE",
      entity: "Page",
      entityId: page.id,
      metadata: {
        title: parsed.data.title,
        featuredMediaId: parsed.data.featuredMediaId ?? null,
        status: targetStatus,
      },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/pages");
    revalidatePath(`/pages/${page.slug}`);

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal membuat halaman" };
  }
}

export async function updatePage(formData: FormData) {
  try {
    const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

    const pageId = formData.get("pageId");
    if (typeof pageId !== "string") {
      return { error: "Halaman tidak ditemukan" };
    }

    const existing = await prisma.page.findUnique({ where: { id: pageId } });
    if (!existing) {
      return { error: "Halaman tidak ditemukan" };
    }

    if (session.user.role === "AUTHOR" && existing.authorId !== session.user.id) {
      return { error: "Tidak diizinkan mengubah halaman ini" };
    }

    let parsedContent = existing.content as Record<string, unknown>;
    const rawContent = formData.get("content");
    if (typeof rawContent === "string" && rawContent.trim()) {
      try {
        parsedContent = JSON.parse(rawContent);
      } catch {
        return { error: "Konten tidak valid" };
      }
    }

    const rawFeaturedMediaId = formData.get("featuredMediaId");
    const shouldDisconnectFeaturedMedia = rawFeaturedMediaId === "__REMOVE__";
    const featuredMediaId =
      typeof rawFeaturedMediaId === "string" && rawFeaturedMediaId.trim() && rawFeaturedMediaId !== "__REMOVE__"
        ? rawFeaturedMediaId
        : undefined;

    const intentRaw = formData.get("intent");
    const intent = typeof intentRaw === "string" && intentRaw === "publish" ? "publish" : "draft";
    const targetStatus = intent === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.DRAFT;
    const targetPublishedAt =
      targetStatus === ArticleStatus.PUBLISHED ? existing.publishedAt ?? new Date() : null;

    const updatePayload = pageUpdateSchema.safeParse({
      title: formData.get("title") || undefined,
      slug: (formData.get("slug") || undefined) as string | undefined,
      excerpt: formData.get("excerpt") || undefined,
      content: parsedContent,
      featuredMediaId,
    });

    if (!updatePayload.success) {
      return { error: updatePayload.error.issues[0]?.message ?? "Data halaman tidak valid" };
    }

    const data = updatePayload.data;
    const contentPlainText = extractPlainText(parsedContent as Record<string, unknown>);
    const candidateTitle = data.title ?? existing.title;
    const candidateExcerpt = data.excerpt ?? existing.excerpt ?? null;
    const forbiddenMatch = await findForbiddenPhraseInInputs([
      candidateTitle,
      candidateExcerpt,
      contentPlainText,
    ]);
    if (forbiddenMatch) {
      return {
        error: `Konten mengandung kata/kalimat terlarang "${forbiddenMatch.phrase}". Hapus kata tersebut sebelum melanjutkan.`,
      };
    }

    const updates: Prisma.PageUpdateInput = {};

    if (data.title) updates.title = data.title;
    if (data.slug) updates.slug = data.slug;
    if (data.excerpt !== undefined) updates.excerpt = data.excerpt ?? null;
    if (data.content) updates.content = data.content as Prisma.InputJsonValue;
    updates.status = targetStatus;
    updates.publishedAt = targetPublishedAt;
    if (featuredMediaId !== undefined) {
      updates.featuredMedia = { connect: { id: featuredMediaId } };
    } else if (shouldDisconnectFeaturedMedia) {
      updates.featuredMedia = { disconnect: true };
    }

    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    const page = await prisma.page.update({
      where: { id: pageId },
      data: updates,
    });

    await writeAuditLog({
      action: "PAGE_UPDATE",
      entity: "Page",
      entityId: pageId,
      metadata: {
        title: page.title,
        featuredMediaId: page.featuredMediaId ?? null,
        status: targetStatus,
      },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${pageId}/edit`);
    revalidatePath(`/pages/${page.slug}`);
    if (page.slug !== existing.slug) {
      revalidatePath(`/pages/${existing.slug}`);
    }
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui halaman" };
  }
}

export async function updateArticle(formData: FormData) {
  try {
    const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

    if (session.user.role === "AUTHOR") {
      const author = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
      if (!author?.canPublish) {
        return {
          error: "Akun penulis Anda menunggu persetujuan admin sebelum dapat mengubah artikel.",
        };
      }
    }

    const parsed = articleUpdateFormSchema.safeParse({
      articleId: formData.get("articleId"),
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      content: formData.get("content") || JSON.stringify(EMPTY_TIPTAP_DOC),
      featuredMediaId: (formData.get("featuredMediaId") || null) as string | null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data artikel tidak valid" };
    }

    const article = await prisma.article.findUnique({
      where: { id: parsed.data.articleId },
      select: { id: true, authorId: true, slug: true, title: true, excerpt: true, publishedAt: true },
    });

    if (!article) {
      return { error: "Artikel tidak ditemukan" };
    }

    if (session.user.role === "AUTHOR" && article.authorId !== session.user.id) {
      return { error: "Tidak diizinkan mengubah artikel ini" };
    }

    const intentRaw = formData.get("intent");
    const intent = typeof intentRaw === "string" && intentRaw === "publish" ? "publish" : "draft";
    const targetStatus = intent === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.DRAFT;
    const nextPublishedAt =
      targetStatus === ArticleStatus.PUBLISHED ? article.publishedAt ?? new Date() : null;

    const tagNames = normalizeTagNames(formData.get("tags"));
    const categoryNames = normalizeCategoryNames(formData.get("categories"));
    const uniqueSlug = await ensureUniqueArticleSlug(
      parsed.data.slug ?? article.slug ?? parsed.data.title ?? article.title,
      article.id
    );
    const generatedExcerpt =
      generateExcerptFromContent(parsed.data.content as Record<string, unknown>) ?? null;

    const contentPlainText = extractPlainText(parsed.data.content as Record<string, unknown>);
    const forbiddenMatch = await findForbiddenPhraseInInputs([
      parsed.data.title,
      generatedExcerpt,
      contentPlainText,
    ]);
    if (forbiddenMatch) {
      return {
        error: `Konten mengandung kata/kalimat terlarang "${forbiddenMatch.phrase}". Hapus kata tersebut sebelum melanjutkan.`,
      };
    }

    const updateData: Prisma.ArticleUpdateInput = {
      title: parsed.data.title,
      slug: uniqueSlug,
      excerpt: generatedExcerpt,
      content: parsed.data.content as Prisma.InputJsonValue,
      featured:
        parsed.data.featuredMediaId !== undefined ? Boolean(parsed.data.featuredMediaId) : undefined,
      featuredMedia:
        parsed.data.featuredMediaId !== undefined
          ? parsed.data.featuredMediaId
            ? { connect: { id: parsed.data.featuredMediaId } }
            : { disconnect: true }
          : undefined,
      status: targetStatus,
      publishedAt: nextPublishedAt,
    };

    await prisma.$transaction(async (tx) => {
      const categoryIds: string[] = [];
      for (const categoryName of categoryNames) {
        const category = await ensureCategory(tx, categoryName);
        categoryIds.push(category.id);
      }

      const tagIds: string[] = [];
      for (const tagName of tagNames) {
        const tag = await ensureTag(tx, tagName);
        tagIds.push(tag.id);
      }

      await tx.article.update({
        where: { id: parsed.data.articleId },
        data: updateData,
      });

      await tx.articleTag.deleteMany({ where: { articleId: parsed.data.articleId } });
      if (tagIds.length) {
        await tx.articleTag.createMany({
          data: tagIds.map((tagId) => ({ articleId: parsed.data.articleId, tagId })),
          skipDuplicates: true,
        });
      }

      await tx.articleCategory.deleteMany({ where: { articleId: parsed.data.articleId } });
      if (categoryIds.length) {
        const baseTime = Date.now();
        await tx.articleCategory.createMany({
          data: categoryIds.map((categoryId, index) => ({
            articleId: parsed.data.articleId,
            categoryId,
            assignedAt: new Date(baseTime + index),
          })),
          skipDuplicates: true,
        });
      }

    });

    await writeAuditLog({
      action: "ARTICLE_UPDATE",
      entity: "Article",
      entityId: parsed.data.articleId,
      metadata: {
        title: parsed.data.title,
        featuredMediaId: parsed.data.featuredMediaId ?? null,
        status: targetStatus,
      },
    });

    revalidatePath(`/dashboard/articles/${parsed.data.articleId}/edit`);
    revalidatePath("/dashboard/articles");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui artikel" };
  }
}

export async function deleteArticle(articleId: string) {
  try {
    await assertArticleOwnership(articleId);

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, slug: true, title: true },
    });

    if (!article) {
      return { error: "Artikel tidak ditemukan" };
    }

    await prisma.article.delete({ where: { id: articleId } });

    await writeAuditLog({
      action: "ARTICLE_DELETE",
      entity: "Article",
      entityId: articleId,
      metadata: { title: article.title },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/articles");
    if (article.slug) {
      revalidatePath(`/articles/${article.slug}`);
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal menghapus artikel" };
  }
}

export async function bulkUpdateArticleStatus(formData: FormData) {
  try {
    const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);
    const rawIds = formData
      .getAll("articleIds")
      .map((value) => (typeof value === "string" ? value : String(value)))
      .filter(Boolean);
    const uniqueIds = Array.from(new Set(rawIds));
    const parsed = bulkArticleStatusSchema.safeParse({
      articleIds: uniqueIds,
      intent: formData.get("intent"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    }

    const articleIds = parsed.data.articleIds;
    const targetStatus =
      parsed.data.intent === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.DRAFT;

    if (session.user.role === "AUTHOR" && targetStatus === ArticleStatus.PUBLISHED) {
      const author = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { canPublish: true },
      });
      if (!author?.canPublish) {
        return {
          error: "Akun penulis Anda menunggu persetujuan admin sebelum dapat mempublikasikan artikel.",
        };
      }
    }

    const articles = await prisma.article.findMany({
      where: {
        id: { in: articleIds },
        ...(session.user.role === "AUTHOR" ? { authorId: session.user.id } : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publishedAt: true,
      },
    });

    if (articles.length === 0) {
      return { error: "Artikel tidak ditemukan atau tidak diizinkan." };
    }

    if (articles.length !== articleIds.length) {
      return { error: "Beberapa artikel tidak dapat diperbarui." };
    }

    await prisma.$transaction(async (tx) => {
      for (const article of articles) {
        const nextPublishedAt =
          targetStatus === ArticleStatus.PUBLISHED
            ? article.publishedAt ?? new Date()
            : null;
        await tx.article.update({
          where: { id: article.id },
          data: {
            status: targetStatus,
            publishedAt: nextPublishedAt,
          },
        });
      }
    });

    await Promise.all(
      articles.map((article) =>
        writeAuditLog({
          action: "ARTICLE_UPDATE",
          entity: "Article",
          entityId: article.id,
          metadata: {
            title: article.title,
            status: targetStatus,
            bulk: true,
          },
        })
      )
    );

    revalidateTag("content");
    revalidatePath("/dashboard/articles");
    for (const article of articles) {
      if (article.slug) {
        revalidatePath(`/articles/${article.slug}`);
      }
    }

    return { success: true, updated: articles.length, status: targetStatus };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui status artikel secara massal." };
  }
}
