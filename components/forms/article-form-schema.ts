import { ArticleStatus } from "@prisma/client";
import { z } from "zod";

export const articleFormSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter"),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  content: z.object({}).passthrough(),
  status: z.nativeEnum(ArticleStatus).optional(),
});

export type ArticleFormValues = z.infer<typeof articleFormSchema>;
