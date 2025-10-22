import { z } from "zod";

export const articleContentSchema = z.object({}).passthrough();

const statusEnum = z.enum(["DRAFT", "REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);

export const articleCreateSchema = z
  .object({
    title: z.string().min(5, "Judul minimal 5 karakter"),
    slug: z.string().optional(),
    excerpt: z.string().max(500).optional(),
    content: articleContentSchema,
    status: statusEnum.optional(),
    publishedAt: z.coerce.date().optional(),
    featured: z.boolean().optional(),
    categoryIds: z.array(z.string().cuid()).default([]),
    tagIds: z.array(z.string().cuid()).default([]),
    featuredMediaId: z.string().cuid().optional(),
  })
  .strict();

export const articleUpdateSchema = z
  .object({
    title: z.string().min(5, "Judul minimal 5 karakter").optional(),
    slug: z.string().optional(),
    excerpt: z.string().max(500).optional(),
    content: articleContentSchema.optional(),
    status: statusEnum.optional(),
    publishedAt: z.coerce.date().optional(),
    featured: z.boolean().optional(),
    categoryIds: z.array(z.string().cuid()).optional(),
    tagIds: z.array(z.string().cuid()).optional(),
    featuredMediaId: z.string().cuid().optional(),
  })
  .strict();

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;
