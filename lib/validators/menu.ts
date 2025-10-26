import { z } from "zod";

const ALLOWED_URL_SCHEMES = new Set(["http", "https", "mailto", "tel", "sms"]);

const menuUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value.length === 0) {
        return false;
      }
      if (value.startsWith("/")) {
        return true;
      }
      try {
        const parsed = new URL(value);
        return ALLOWED_URL_SCHEMES.has(parsed.protocol.replace(/:$/, "").toLowerCase());
      } catch {
        return false;
      }
    },
    { message: "URL tidak valid. Gunakan tautan relatif atau skema http/https/mailto/tel/sms." }
  );

export const menuItemCreateSchema = z
  .object({
    menu: z.string().min(2, "Nama menu minimal 2 karakter"),
    title: z.string().min(2, "Judul minimal 2 karakter"),
    slug: z.string().optional(),
    url: menuUrlSchema.optional(),
    icon: z.string().max(100).optional(),
    order: z.number().int().min(0).optional(),
    parentId: z.string().cuid().nullable().optional(),
    pageId: z.string().cuid().nullable().optional(),
    isExternal: z.boolean().optional(),
    categorySlug: z.string().trim().min(1).optional(),
    albumId: z.string().cuid().nullable().optional(),
  })
  .strict();

export const menuItemUpdateSchema = z
  .object({
    title: z.string().min(2, "Judul minimal 2 karakter").optional(),
    slug: z.string().optional().or(z.literal("")),
    url: menuUrlSchema.optional().or(z.literal("")),
    icon: z.string().max(100).optional().or(z.literal("")),
    order: z.number().int().min(0).optional(),
    parentId: z.string().cuid().nullable().optional(),
    pageId: z.string().cuid().nullable().optional(),
    isExternal: z.boolean().optional(),
    categorySlug: z.string().trim().optional().or(z.literal("")),
    albumId: z.string().cuid().nullable().optional(),
  })
  .strict();

export const menuReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().cuid(),
      order: z.number().int().min(0),
      parentId: z.string().cuid().nullable().optional(),
    })
  ),
});
