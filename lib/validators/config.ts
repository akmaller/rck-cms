import { z } from "zod";

const urlOrPathSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      value.startsWith("/") ||
      value.startsWith("http://") ||
      value.startsWith("https://"),
    { message: "URL tidak valid" }
  );

const absoluteUrlSchema = z
  .string()
  .trim()
  .refine((value) => !value || value.startsWith("http://") || value.startsWith("https://"), {
    message: "URL harus diawali http(s)",
  });

export const siteConfigSchema = z.object({
  siteName: z.string().min(2, "Nama situs minimal 2 karakter").optional(),
  logoUrl: urlOrPathSchema.optional(),
  iconUrl: urlOrPathSchema.optional(),
  siteUrl: absoluteUrlSchema.optional(),
  tagline: z.string().max(200).optional(),
  timezone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  social: z
    .object({
      facebook: absoluteUrlSchema.optional(),
      instagram: absoluteUrlSchema.optional(),
      youtube: absoluteUrlSchema.optional(),
      twitter: absoluteUrlSchema.optional(),
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
  cache: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  comments: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  analytics: z
    .object({
      googleTagManagerId: z
        .string()
        .trim()
        .regex(/^(?:GTM-[A-Z0-9]+|G-[A-Z0-9]+|UA-[A-Z0-9-]+)$/i, "Google Tag ID tidak valid")
        .optional()
        .nullable(),
    })
    .optional(),
  registration: z
    .object({
      enabled: z.boolean().optional(),
      autoApprove: z.boolean().optional(),
      privacyPolicyPageSlug: z
        .string()
        .trim()
        .min(1, "Halaman kebijakan & privasi tidak valid")
        .optional()
        .nullable(),
    })
    .optional(),
});

export type SiteConfigInput = z.infer<typeof siteConfigSchema>;
