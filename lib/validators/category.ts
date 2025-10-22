import { z } from "zod";

const baseSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(100),
    slug: z.string().optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

export const categoryCreateSchema = baseSchema;

export const categoryUpdateSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(100).optional(),
    slug: z.string().optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
