"use server";

import { ArticleStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils/slug";
import { menuItemCreateSchema } from "@/lib/validators/menu";
import { pageCreateSchema } from "@/lib/validators/page";
import { siteConfigSchema } from "@/lib/validators/config";
import { writeAuditLog } from "@/lib/audit/log";
import { revalidatePath, revalidateTag } from "next/cache";

const EMPTY_TIPTAP_DOC = { type: "doc", content: [] } as const;

const articleFormSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter"),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional(),
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

    const parsed = articleFormSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      excerpt: formData.get("excerpt") || undefined,
      content: formData.get("content") || JSON.stringify(EMPTY_TIPTAP_DOC),
      featuredMediaId: (formData.get("featuredMediaId") || null) as string | null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    }

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.title);
    const safeBase = baseSlug.length > 0 ? baseSlug : `artikel-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const existing = await prisma.article.findUnique({ where: { slug: candidate } });
      if (!existing) break;
      candidate = `${safeBase}-${counter++}`;
    }

    const article = await prisma.article.create({
      data: {
        title: parsed.data.title,
        slug: candidate,
        excerpt: parsed.data.excerpt,
        content: parsed.data.content,
        status: ArticleStatus.DRAFT,
        authorId: session.user.id,
        featuredMediaId: parsed.data.featuredMediaId ?? null,
      },
    });

    await writeAuditLog({
      action: "ARTICLE_CREATE",
      entity: "Article",
      entityId: article.id,
      metadata: { title: parsed.data.title, featuredMediaId: parsed.data.featuredMediaId ?? null },
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

const tagFormSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  slug: z.string().optional(),
});

export async function createTag(formData: FormData) {
  try {
    await assertRole(["EDITOR", "ADMIN"]);

    const parsed = tagFormSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug") || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data tag tidak valid" };
    }

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.name);
    const safeBase = baseSlug.length > 0 ? baseSlug : `tag-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const exists = await prisma.tag.findUnique({ where: { slug: candidate } });
      if (!exists) break;
      candidate = `${safeBase}-${counter++}`;
    }

    const tag = await prisma.tag.create({
      data: {
        name: parsed.data.name,
        slug: candidate,
      },
    });

    await writeAuditLog({
      action: "TAG_CREATE",
      entity: "Tag",
      entityId: tag.id,
      metadata: { name: parsed.data.name },
    });

    revalidateTag("content");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal membuat tag" };
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

export async function createMenuItem(formData: FormData) {
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
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data menu tidak valid" };
    }

    if (parsed.data.url && parsed.data.pageId) {
      return { error: "Gunakan URL atau tautan halaman, bukan keduanya" };
    }

    if (parsed.data.parentId) {
      const parent = await prisma.menuItem.findUnique({ where: { id: parsed.data.parentId } });
      if (!parent || parent.menu !== parsed.data.menu) {
        return { error: "Parent menu harus berada dalam menu yang sama" };
      }
    }

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.title);
    const safeBase = baseSlug.length > 0 ? baseSlug : `menu-${Date.now()}`;
    let candidate = safeBase;
    let counter = 1;
    while (true) {
      const exists = await prisma.menuItem.findUnique({ where: { slug: candidate } });
      if (!exists) break;
      candidate = `${safeBase}-${counter++}`;
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        menu: parsed.data.menu,
        title: parsed.data.title,
        slug: candidate,
        url: parsed.data.url,
        icon: parsed.data.icon,
        order: parsed.data.order ?? 0,
        parentId: parsed.data.parentId ?? null,
        pageId: parsed.data.pageId ?? null,
        isExternal: parsed.data.isExternal || Boolean(parsed.data.url),
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

    const social = {
      facebook: sanitize(formData.get("social.facebook")),
      instagram: sanitize(formData.get("social.instagram")),
      youtube: sanitize(formData.get("social.youtube")),
      twitter: sanitize(formData.get("social.twitter")),
    };

    const metadata = {
      title: sanitize(formData.get("metadata.title")),
      description: sanitize(formData.get("metadata.description")),
      keywords,
    };

    const data = {
      siteName: sanitize(formData.get("siteName")),
      logoUrl: sanitize(formData.get("logoUrl")),
      tagline: sanitize(formData.get("tagline")),
      contactEmail: sanitize(formData.get("contactEmail")),
      social,
      metadata,
    };

    if (Object.values(social).every((value) => value === undefined)) {
      delete (data as typeof data & { social?: undefined }).social;
    }

    if (
      keywords === undefined &&
      metadata.title === undefined &&
      metadata.description === undefined
    ) {
      delete (data as typeof data & { metadata?: undefined }).metadata;
    } else if (keywords === undefined) {
      delete metadata.keywords;
    }

    const parsed = siteConfigSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data konfigurasi tidak valid" };
    }

    const config = await prisma.siteConfig.upsert({
      where: { key: "general" },
      update: { value: parsed.data },
      create: { key: "general", value: parsed.data },
    });

    await writeAuditLog({
      action: "CONFIG_UPDATE",
      entity: "SiteConfig",
      entityId: config.id,
      metadata: parsed.data,
    });

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

    const parsed = pageCreateSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      excerpt: formData.get("excerpt") || undefined,
      content: parsedContent,
      featuredMediaId: (formData.get("featuredMediaId") || null) as string | null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data halaman tidak valid" };
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
        content: parsed.data.content,
        status: ArticleStatus.DRAFT,
        authorId: session.user.id,
        featuredMediaId: parsed.data.featuredMediaId ?? null,
      },
    });

    await writeAuditLog({
      action: "PAGE_CREATE",
      entity: "Page",
      entityId: page.id,
      metadata: { title: parsed.data.title, featuredMediaId: parsed.data.featuredMediaId ?? null },
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

    const updatePayload = pageUpdateSchema.safeParse({
      title: formData.get("title") || undefined,
      slug: (formData.get("slug") || undefined) as string | undefined,
      excerpt: formData.get("excerpt") || undefined,
      content: parsedContent,
      featuredMediaId: (formData.get("featuredMediaId") || null) as string | null | undefined,
    });

    if (!updatePayload.success) {
      return { error: updatePayload.error.issues[0]?.message ?? "Data halaman tidak valid" };
    }

    const data = updatePayload.data;
    const updates: Prisma.PageUpdateInput = {};

    if (data.title) updates.title = data.title;
    if (data.slug) updates.slug = data.slug;
    if (data.excerpt !== undefined) updates.excerpt = data.excerpt ?? null;
    if (data.content) updates.content = data.content;
    if (data.status) updates.status = data.status;
    if (data.publishedAt !== undefined) updates.publishedAt = data.publishedAt ?? null;
    if (data.featuredMediaId !== undefined) {
      updates.featuredMedia = data.featuredMediaId
        ? { connect: { id: data.featuredMediaId } }
        : { disconnect: true };
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
      metadata: { title: page.title, featuredMediaId: page.featuredMediaId ?? null },
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

    const parsed = articleUpdateFormSchema.safeParse({
      articleId: formData.get("articleId"),
      title: formData.get("title"),
      slug: formData.get("slug") || undefined,
      excerpt: formData.get("excerpt") || undefined,
      content: formData.get("content") || JSON.stringify(EMPTY_TIPTAP_DOC),
      featuredMediaId: (formData.get("featuredMediaId") || null) as string | null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Data artikel tidak valid" };
    }

    const article = await prisma.article.findUnique({
      where: { id: parsed.data.articleId },
      select: { id: true, authorId: true },
    });

    if (!article) {
      return { error: "Artikel tidak ditemukan" };
    }

    if (session.user.role === "AUTHOR" && article.authorId !== session.user.id) {
      return { error: "Tidak diizinkan mengubah artikel ini" };
    }

    await prisma.article.update({
      where: { id: parsed.data.articleId },
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug || undefined,
        excerpt: parsed.data.excerpt,
        content: parsed.data.content,
        featured: parsed.data.featuredMediaId !== undefined ? Boolean(parsed.data.featuredMediaId) : undefined,
        featuredMedia:
          parsed.data.featuredMediaId !== undefined
            ? parsed.data.featuredMediaId
              ? { connect: { id: parsed.data.featuredMediaId } }
              : { disconnect: true }
            : undefined,
      },
    });

    await writeAuditLog({
      action: "ARTICLE_UPDATE",
      entity: "Article",
      entityId: parsed.data.articleId,
      metadata: { title: parsed.data.title, featuredMediaId: parsed.data.featuredMediaId ?? null },
    });

    revalidatePath(`/dashboard/articles/${parsed.data.articleId}/edit`);
    revalidatePath("/dashboard/articles");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui artikel" };
  }
}
