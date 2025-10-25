import { z } from "zod";

export const securityPolicySchema = z.object({
  loginMaxAttempts: z.coerce.number().int().min(1).max(1000),
  loginWindowMinutes: z.coerce.number().int().min(1).max(1440),
  pageMaxVisits: z.coerce.number().int().min(1).max(5000),
  pageWindowMinutes: z.coerce.number().int().min(1).max(1440),
  apiMaxRequests: z.coerce.number().int().min(1).max(10000),
  apiWindowMinutes: z.coerce.number().int().min(1).max(1440),
  blockDurationMinutes: z.coerce.number().int().min(1).max(1440 * 7),
});

export type SecurityPolicyInput = z.infer<typeof securityPolicySchema>;
