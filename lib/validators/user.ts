import { z } from "zod";

export const userCreateSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter"),
    email: z.string().email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    role: z.enum(["ADMIN", "EDITOR", "AUTHOR"]),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").optional(),
    email: z.string().email("Email tidak valid").optional(),
    password: z.string().min(8, "Password minimal 8 karakter").optional(),
    role: z.enum(["ADMIN", "EDITOR", "AUTHOR"]).optional(),
    bio: z.string().max(500).optional(),
  })
  .strict();
