import { z } from "zod";

export const MAX_COMMENT_LENGTH = 1000;

export const commentCreateSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Komentar wajib diisi." })
    .max(MAX_COMMENT_LENGTH, {
      message: `Komentar maksimal ${MAX_COMMENT_LENGTH} karakter.`,
    })
    .refine(
      (value) => value.replace(/[\s\r\n\t]/g, "").length > 0,
      "Komentar tidak boleh hanya berisi spasi."
    ),
  parentId: z
    .string()
    .trim()
    .cuid()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
