import { z } from "zod";

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
        return Boolean(parsed);
      } catch {
        return false;
      }
    },
    { message: "URL tidak valid. Gunakan tautan absolut atau yang diawali '/'." }
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
