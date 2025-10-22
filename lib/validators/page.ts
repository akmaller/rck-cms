import { z } from "zod";

export const pageContentSchema = z.object({}).passthrough();

export const pageCreateSchema = z
  .object({
    title: z.string().min(3, "Judul minimal 3 karakter"),
    slug: z.string().optional(),
    excerpt: z.string().max(500).optional(),
    content: pageContentSchema,
    status: z.enum(["DRAFT", "REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
    publishedAt: z.coerce.date().optional(),
    featuredMediaId: z.string().cuid().optional(),
  })
  .strict();

export const pageUpdateSchema = z
  .object({
    title: z.string().min(3, "Judul minimal 3 karakter").optional(),
    slug: z.string().optional(),
    excerpt: z.string().max(500).optional(),
    content: pageContentSchema.optional(),
    status: z.enum(["DRAFT", "REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
    publishedAt: z.coerce.date().optional(),
    featuredMediaId: z.string().cuid().optional(),
  })
  .strict();
