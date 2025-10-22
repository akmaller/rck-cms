import { z } from "zod";

const baseSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(50),
    slug: z.string().optional(),
  })
  .strict();

export const tagCreateSchema = baseSchema;

export const tagUpdateSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(50).optional(),
    slug: z.string().optional(),
  })
  .strict();

export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;
