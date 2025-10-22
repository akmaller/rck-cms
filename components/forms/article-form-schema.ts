import { zfd } from "zod-form-data";
import { ArticleStatus } from "@prisma/client";

export const articleFormSchema = zfd.formData({
  title: zfd.text(z => z.min(5, "Judul minimal 5 karakter")),
  slug: zfd.text(z => z.optional()),
  excerpt: zfd.text(z => z.max(500).optional()),
  content: zfd.json<Record<string, unknown>>(),
  status: zfd.text(z => z.nativeEnum(ArticleStatus)).optional(),
});

export type ArticleFormValues = ReturnType<typeof articleFormSchema.parse>;
