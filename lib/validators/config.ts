import { z } from "zod";

export const siteConfigSchema = z.object({
  siteName: z.string().min(2, "Nama situs minimal 2 karakter").optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  tagline: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  social: z
    .object({
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      youtube: z.string().url().optional(),
      twitter: z.string().url().optional(),
    })
    .partial()
    .optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().max(300).optional(),
      keywords: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
});

export type SiteConfigInput = z.infer<typeof siteConfigSchema>;
