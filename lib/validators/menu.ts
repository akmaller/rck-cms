import { z } from "zod";

export const menuItemCreateSchema = z
  .object({
    menu: z.string().min(2, "Nama menu minimal 2 karakter"),
    title: z.string().min(2, "Judul minimal 2 karakter"),
    slug: z.string().optional(),
    url: z.string().url().optional(),
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
    slug: z.string().optional(),
    url: z.string().url().optional(),
    icon: z.string().max(100).optional(),
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
