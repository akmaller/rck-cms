"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { Prisma } from "@prisma/client";
import type { ArticleStatus, UserRole, UserTheme } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { siteConfigSchema } from "@/lib/validators/config";

export async function clearCacheAction() {
  try {
    await assertRole(["EDITOR", "ADMIN"]);
    revalidateTag("content");
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath("/sitemap.xml");
    revalidatePath("/rss.xml");
    return { success: true, message: "Cache halaman publik berhasil dibersihkan." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal membersihkan cache." };
  }
}

type ExportedAccount = {
  id: string;
  userId?: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
};

type ExportedSession = {
  id: string;
  userId?: string;
  sessionToken: string;
  expires: string;
};

type ExportedUser = {
  id: string;
  email: string;
  passwordHash?: string | null;
  name: string;
  avatarUrl?: string | null;
  role?: UserRole | string;
  bio?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  lastLoginAt?: string | null;
  theme?: UserTheme | string;
  createdAt?: string | null;
  updatedAt?: string | null;
  accounts?: ExportedAccount[];
  sessions?: ExportedSession[];
};

type ExportedMedia = {
  id: string;
  title: string;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  storageType?: string;
  createdAt?: string | null;
  createdById?: string | null;
  description?: string | null;
};

type ExportedCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ExportedArticleCategoryLink = {
  articleId?: string;
  categoryId?: string;
  assignedAt?: string | null;
  category?: ExportedCategory | null;
};

type ExportedTag = {
  id: string;
  name: string;
  slug: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ExportedArticleTagLink = {
  articleId?: string;
  tagId?: string;
  assignedAt?: string | null;
  tag?: ExportedTag | null;
};

type ExportedArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: unknown;
  status?: ArticleStatus | string;
  publishedAt?: string | null;
  featured?: boolean;
  authorId: string;
  featuredMediaId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  categories?: ExportedArticleCategoryLink[];
  tags?: ExportedArticleTagLink[];
};

type ExportedMenuItem = {
  id: string;
  menu: string;
  title: string;
  slug?: string | null;
  url?: string | null;
  icon?: string | null;
  order?: number | null;
  parentId?: string | null;
  pageId?: string | null;
  isExternal?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ExportedPage = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: unknown;
  status?: ArticleStatus | string;
  publishedAt?: string | null;
  authorId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  featuredMediaId?: string | null;
  menuItems?: ExportedMenuItem[];
};

type ExportedAuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  createdAt?: string | null;
};

type BackupPayload = {
  exportedAt?: string;
  sections?: string[];
  siteConfig?: Record<string, unknown>;
  users?: ExportedUser[];
  media?: ExportedMedia[];
  articles?: ExportedArticle[];
  pages?: ExportedPage[];
  auditLogs?: ExportedAuditLog[];
};

function toDate(value: unknown): Date | null {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function parseBackupFromJson(text: string): BackupPayload | null {
  try {
    const parsed = JSON.parse(text) as BackupPayload;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function parseSqlSiteConfigEntries(sql: string): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  const insertRegex =
    /INSERT\s+INTO\s+"SiteConfig"\s+\("key","value","updatedAt"\)\s+VALUES\s+\('([^']+)'\s*,\s*'((?:[^']|'')*)'::jsonb,\s*NOW\(\)\)\s+ON\s+CONFLICT\s+\("key"\)\s+DO\s+UPDATE\s+SET\s+"value"\s*=\s*EXCLUDED\."value",\s+"updatedAt"\s*=\s*NOW\(\);\s*/gi;

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sql)) !== null) {
    const key = match[1];
    const jsonLiteral = match[2].replace(/''/g, "'");
    try {
      entries[key] = JSON.parse(jsonLiteral);
    } catch {
      // ignore malformed entries
    }
  }

  return entries;
}

function parseBackupFromSql(sql: string): BackupPayload | null {
  const siteConfigEntries = parseSqlSiteConfigEntries(sql);
  let payload: BackupPayload | null = null;

  const commentJsonMatch = sql.match(/--\s*\{[\s\S]*$/);
  if (commentJsonMatch) {
    const commentBody = commentJsonMatch[0].replace(/^--\s?/gm, "");
    try {
      const parsed = JSON.parse(commentBody) as BackupPayload;
      if (parsed && typeof parsed === "object") {
        payload = parsed;
      }
    } catch {
      // ignore malformed comment payloads
    }
  }

  if (payload) {
    if (Object.keys(siteConfigEntries).length > 0) {
      payload.siteConfig =
        payload.siteConfig && typeof payload.siteConfig === "object"
          ? { ...siteConfigEntries, ...payload.siteConfig }
          : siteConfigEntries;
    }
    return payload;
  }

  if (Object.keys(siteConfigEntries).length > 0) {
    return { siteConfig: siteConfigEntries };
  }

  return null;
}

function looksLikeSqlBackup(filename: string | undefined, content: string) {
  if (filename && filename.toLowerCase().endsWith(".sql")) {
    return true;
  }
  return /INSERT\s+INTO\s+"SiteConfig"/i.test(content) || content.trimStart().startsWith("--");
}

export async function importBackupAction(formData: FormData) {
  try {
    await assertRole("ADMIN");
    const file = formData.get("backupFile");
    if (!(file instanceof File)) {
      return { success: false, message: "File backup tidak ditemukan." };
    }

    const fileText = await file.text();
    let format: "json" | "sql" = "json";
    let payload: BackupPayload | null = null;

    if (looksLikeSqlBackup(file.name, fileText)) {
      format = "sql";
      payload = parseBackupFromSql(fileText);
    } else {
      payload = parseBackupFromJson(fileText);
    }

    if (!payload) {
      return { success: false, message: "File backup tidak berisi data yang dapat diproses." };
    }

    const summary: string[] = [];
    const errors: string[] = [];
    const importedSections = new Set<string>();

    const articleCategoryMap = new Map<
      string,
      Array<{ articleId: string; categoryId: string; assignedAt?: string | null }>
    >();
    const articleTagMap = new Map<
      string,
      Array<{ articleId: string; tagId: string; assignedAt?: string | null }>
    >();
    const categoriesMap = new Map<string, ExportedCategory>();
    const tagsMap = new Map<string, ExportedTag>();
    const menuItemsMap = new Map<string, ExportedMenuItem>();

    if (Array.isArray(payload.articles)) {
      for (const article of payload.articles) {
        if (!article?.id) {
          continue;
        }

        if (Array.isArray(article.categories)) {
          const links: Array<{ articleId: string; categoryId: string; assignedAt?: string | null }> =
            [];
          for (const link of article.categories) {
            if (!link) {
              continue;
            }
            const categoryId = link.categoryId ?? link.category?.id;
            if (!categoryId) {
              continue;
            }
            links.push({
              articleId: link.articleId ?? article.id,
              categoryId,
              assignedAt: link.assignedAt ?? null,
            });
            if (link.category && link.category.id) {
              categoriesMap.set(link.category.id, link.category);
            }
          }
          if (links.length > 0) {
            articleCategoryMap.set(article.id, links);
          }
        }

        if (Array.isArray(article.tags)) {
          const links: Array<{ articleId: string; tagId: string; assignedAt?: string | null }> = [];
          for (const link of article.tags) {
            if (!link) {
              continue;
            }
            const tagId = link.tagId ?? link.tag?.id;
            if (!tagId) {
              continue;
            }
            links.push({
              articleId: link.articleId ?? article.id,
              tagId,
              assignedAt: link.assignedAt ?? null,
            });
            if (link.tag && link.tag.id) {
              tagsMap.set(link.tag.id, link.tag);
            }
          }
          if (links.length > 0) {
            articleTagMap.set(article.id, links);
          }
        }
      }
    }

    if (Array.isArray(payload.pages)) {
      for (const page of payload.pages) {
        if (!page?.id || !Array.isArray(page.menuItems)) {
          continue;
        }
        for (const item of page.menuItems) {
          if (!item || typeof item.id !== "string") {
            continue;
          }
          menuItemsMap.set(item.id, {
            ...item,
            pageId: item.pageId ?? page.id,
          });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const siteConfig =
        payload.siteConfig && typeof payload.siteConfig === "object" ? payload.siteConfig : null;
      if (siteConfig && Object.keys(siteConfig).length > 0) {
        for (const [key, raw] of Object.entries(siteConfig)) {
          try {
            const value =
              key === "general"
                ? (() => {
                    const parsed = siteConfigSchema.safeParse(raw);
                    if (!parsed.success) {
                      throw new Error(parsed.error.issues[0]?.message ?? "Data backup tidak valid.");
                    }
                    return parsed.data;
                  })()
                : raw;
            const jsonValue = value as Prisma.InputJsonValue;

            await tx.siteConfig.upsert({
              where: { key },
              update: { value: jsonValue },
              create: { key, value: jsonValue },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`Site config '${key}' gagal diproses: ${message}`);
          }
        }
        summary.push("Konfigurasi situs");
        importedSections.add("config");
      }

      if (Array.isArray(payload.users) && payload.users.length > 0) {
        for (const rawUser of payload.users) {
          const userRecord = rawUser as ExportedUser & { articles?: unknown; pages?: unknown };
          if (!userRecord?.id || !userRecord.email || !userRecord.name) {
            errors.push("Data pengguna tidak lengkap dan dilewati.");
            continue;
          }

          const { accounts, sessions, ...userData } = userRecord;

          const lastLoginAt = toDate(userData.lastLoginAt);
          const createdAt = toDate(userData.createdAt);

          const createData: Prisma.UserUncheckedCreateInput = {
            id: userData.id,
            email: userData.email,
            passwordHash: userData.passwordHash ?? null,
            name: userData.name,
            avatarUrl: userData.avatarUrl ?? null,
            role: (userData.role ?? "AUTHOR") as UserRole,
            bio: userData.bio ?? null,
            twoFactorEnabled: userData.twoFactorEnabled ?? false,
            twoFactorSecret: userData.twoFactorSecret ?? null,
            lastLoginAt,
            theme: (userData.theme ?? "LIGHT") as UserTheme,
            createdAt: createdAt ?? undefined,
          };

          const updateData: Prisma.UserUncheckedUpdateInput = {
            email: userData.email,
            passwordHash: userData.passwordHash ?? null,
            name: userData.name,
            avatarUrl: userData.avatarUrl ?? null,
            role: (userData.role ?? "AUTHOR") as UserRole,
            bio: userData.bio ?? null,
            twoFactorEnabled: userData.twoFactorEnabled ?? false,
            twoFactorSecret: userData.twoFactorSecret ?? null,
            lastLoginAt,
            theme: (userData.theme ?? "LIGHT") as UserTheme,
          };

          await tx.user.upsert({
            where: { id: userData.id },
            create: createData,
            update: updateData,
          });

          await tx.account.deleteMany({ where: { userId: userData.id } });
          if (Array.isArray(accounts) && accounts.length > 0) {
            await tx.account.createMany({
              data: accounts.map((account) => ({
                id: account.id,
                userId: account.userId ?? userData.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token ?? null,
                access_token: account.access_token ?? null,
                expires_at: account.expires_at ?? null,
                token_type: account.token_type ?? null,
                scope: account.scope ?? null,
                id_token: account.id_token ?? null,
                session_state: account.session_state ?? null,
              })),
              skipDuplicates: true,
            });
          }

          await tx.session.deleteMany({ where: { userId: userData.id } });
          if (Array.isArray(sessions) && sessions.length > 0) {
            await tx.session.createMany({
              data: sessions.map((session) => ({
                id: session.id,
                userId: session.userId ?? userData.id,
                sessionToken: session.sessionToken,
                expires: toDate(session.expires) ?? new Date(),
              })),
              skipDuplicates: true,
            });
          }
        }
        summary.push("Pengguna");
        importedSections.add("users");
      }

      if (Array.isArray(payload.media) && payload.media.length > 0) {
        for (const media of payload.media) {
          if (!media?.id || !media.title || !media.fileName || !media.url || !media.mimeType) {
            errors.push("Data media tidak lengkap dan dilewati.");
            continue;
          }
          const createdAt = toDate(media.createdAt);
          await tx.media.upsert({
            where: { id: media.id },
            create: {
              id: media.id,
              title: media.title,
              fileName: media.fileName,
              url: media.url,
              mimeType: media.mimeType,
              size: typeof media.size === "number" ? media.size : 0,
              width: media.width ?? null,
              height: media.height ?? null,
              storageType: media.storageType ?? "local",
              createdAt: createdAt ?? undefined,
              createdById: media.createdById ?? null,
              description: media.description ?? null,
            },
            update: {
              title: media.title,
              fileName: media.fileName,
              url: media.url,
              mimeType: media.mimeType,
              size: typeof media.size === "number" ? media.size : 0,
              width: media.width ?? null,
              height: media.height ?? null,
              storageType: media.storageType ?? "local",
              createdById: media.createdById ?? null,
              description: media.description ?? null,
            },
          });
        }
        summary.push("Media");
        importedSections.add("media");
      }

      if (categoriesMap.size > 0) {
        for (const category of categoriesMap.values()) {
          if (!category?.id || !category.name || !category.slug) {
            continue;
          }
          const createdAt = toDate(category.createdAt);
          await tx.category.upsert({
            where: { id: category.id },
            create: {
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description ?? null,
              createdAt: createdAt ?? undefined,
            },
            update: {
              name: category.name,
              slug: category.slug,
              description: category.description ?? null,
            },
          });
        }
      }

      if (tagsMap.size > 0) {
        for (const tag of tagsMap.values()) {
          if (!tag?.id || !tag.name || !tag.slug) {
            continue;
          }
          const createdAt = toDate(tag.createdAt);
          await tx.tag.upsert({
            where: { id: tag.id },
            create: {
              id: tag.id,
              name: tag.name,
              slug: tag.slug,
              createdAt: createdAt ?? undefined,
            },
            update: {
              name: tag.name,
              slug: tag.slug,
            },
          });
        }
      }

      if (Array.isArray(payload.articles) && payload.articles.length > 0) {
        for (const article of payload.articles) {
          if (!article?.id || !article.title || !article.slug || !article.authorId) {
            errors.push("Data artikel tidak lengkap dan dilewati.");
            continue;
          }
          const publishedAt = toDate(article.publishedAt);
          const createdAt = toDate(article.createdAt);
          await tx.article.upsert({
            where: { id: article.id },
            create: {
              id: article.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt ?? null,
              content: article.content ?? {},
              status: (article.status ?? "DRAFT") as ArticleStatus,
              publishedAt,
              featured: article.featured ?? false,
              authorId: article.authorId,
              featuredMediaId: article.featuredMediaId ?? null,
              createdAt: createdAt ?? undefined,
            },
            update: {
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt ?? null,
              content: article.content ?? {},
              status: (article.status ?? "DRAFT") as ArticleStatus,
              publishedAt,
              featured: article.featured ?? false,
              authorId: article.authorId,
              featuredMediaId: article.featuredMediaId ?? null,
            },
          });

          const categoryLinks = articleCategoryMap.get(article.id) ?? [];
          await tx.articleCategory.deleteMany({ where: { articleId: article.id } });
          if (categoryLinks.length > 0) {
            await tx.articleCategory.createMany({
              data: categoryLinks.map((link) => ({
                articleId: link.articleId ?? article.id,
                categoryId: link.categoryId,
                assignedAt: toDate(link.assignedAt) ?? new Date(),
              })),
            });
          }

          const tagLinks = articleTagMap.get(article.id) ?? [];
          await tx.articleTag.deleteMany({ where: { articleId: article.id } });
          if (tagLinks.length > 0) {
            await tx.articleTag.createMany({
              data: tagLinks.map((link) => ({
                articleId: link.articleId ?? article.id,
                tagId: link.tagId,
                assignedAt: toDate(link.assignedAt) ?? new Date(),
              })),
            });
          }
        }
        summary.push("Artikel");
        importedSections.add("articles");
      }

      if (Array.isArray(payload.pages) && payload.pages.length > 0) {
        for (const page of payload.pages) {
          if (!page?.id || !page.title || !page.slug || !page.authorId) {
            errors.push("Data halaman tidak lengkap dan dilewati.");
            continue;
          }
          const publishedAt = toDate(page.publishedAt);
          const createdAt = toDate(page.createdAt);
          await tx.page.upsert({
            where: { id: page.id },
            create: {
              id: page.id,
              title: page.title,
              slug: page.slug,
              excerpt: page.excerpt ?? null,
              content: page.content ?? {},
              status: (page.status ?? "DRAFT") as ArticleStatus,
              publishedAt,
              authorId: page.authorId,
              featuredMediaId: page.featuredMediaId ?? null,
              createdAt: createdAt ?? undefined,
            },
            update: {
              title: page.title,
              slug: page.slug,
              excerpt: page.excerpt ?? null,
              content: page.content ?? {},
              status: (page.status ?? "DRAFT") as ArticleStatus,
              publishedAt,
              authorId: page.authorId,
              featuredMediaId: page.featuredMediaId ?? null,
            },
          });
        }
        summary.push("Halaman");
        importedSections.add("pages");
      }

      if (menuItemsMap.size > 0) {
        const items = Array.from(menuItemsMap.values());
        for (const item of items) {
          if (!item?.id || !item.menu || !item.title) {
            continue;
          }
          const createdAt = toDate(item.createdAt);
          await tx.menuItem.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              menu: item.menu,
              title: item.title,
              slug: item.slug ?? null,
              url: item.url ?? null,
              icon: item.icon ?? null,
              order: typeof item.order === "number" ? item.order : 0,
              parentId: null,
              pageId: item.pageId ?? null,
              isExternal: item.isExternal ?? false,
              createdAt: createdAt ?? undefined,
            },
            update: {
              menu: item.menu,
              title: item.title,
              slug: item.slug ?? null,
              url: item.url ?? null,
              icon: item.icon ?? null,
              order: typeof item.order === "number" ? item.order : 0,
              pageId: item.pageId ?? null,
              isExternal: item.isExternal ?? false,
            },
          });
        }

        for (const item of items) {
          if (!item.parentId) {
            try {
              await tx.menuItem.update({
                where: { id: item.id },
                data: { parentId: null },
              });
            } catch {
              // ignore failures for orphan reset
            }
            continue;
          }

          const parentExists =
            menuItemsMap.has(item.parentId) ||
            !!(await tx.menuItem.findUnique({ where: { id: item.parentId } }));
          if (!parentExists) {
            errors.push(`Parent menu item '${item.parentId}' tidak ditemukan untuk '${item.id}'.`);
            continue;
          }

          try {
            await tx.menuItem.update({
              where: { id: item.id },
              data: { parentId: item.parentId },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`Gagal memperbarui parent menu '${item.id}': ${message}`);
          }
        }

        summary.push("Menu navigasi");
        importedSections.add("menus");
      }

      if (Array.isArray(payload.auditLogs) && payload.auditLogs.length > 0) {
        for (const log of payload.auditLogs) {
          if (!log?.id || !log.action || !log.entity || !log.entityId) {
            errors.push("Data audit log tidak lengkap dan dilewati.");
            continue;
          }
          const createdAt = toDate(log.createdAt);
          const metadata = log.metadata === null ? Prisma.JsonNull : (log.metadata as Prisma.InputJsonValue | undefined);

          await tx.auditLog.upsert({
            where: { id: log.id },
            create: {
              id: log.id,
              action: log.action,
              entity: log.entity,
              entityId: log.entityId,
              userId: log.userId ?? null,
              metadata,
              createdAt: createdAt ?? undefined,
            },
            update: {
              action: log.action,
              entity: log.entity,
              entityId: log.entityId,
              userId: log.userId ?? null,
              metadata,
            },
          });
        }
        summary.push("Log aktivitas");
        importedSections.add("audits");
      }
    });

    if (importedSections.has("config")) {
      revalidateTag("site-config");
    }
    if (
      importedSections.has("articles") ||
      importedSections.has("pages") ||
      importedSections.has("media") ||
      importedSections.has("menus")
    ) {
      revalidateTag("content");
      revalidatePath("/");
      revalidatePath("/articles");
    }
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    await prisma.auditLog.create({
      data: {
        action: "BACKUP_IMPORT",
        entity: "Backup",
        entityId: format.toUpperCase(),
        metadata: {
          fileName: file.name ?? null,
          sections: Array.from(importedSections),
          summary,
          warnings: errors,
        },
      },
    });

    const success = errors.length === 0;
    let message = `Backup ${format.toUpperCase()} berhasil diimpor.`;
    if (summary.length > 0) {
      message += ` Data yang diperbarui: ${summary.join(", ")}.`;
    }
    if (errors.length > 0) {
      message += ` Beberapa data tidak dapat diproses: ${errors.join(" | ")}.`;
    } else if (importedSections.size === 0) {
      message += " Tidak ada perubahan data yang diperlukan.";
    }

    return { success, message };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal mengimpor backup." };
  }
}
