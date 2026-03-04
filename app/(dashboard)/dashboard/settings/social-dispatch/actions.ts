"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { dispatchSocialPostJobs } from "@/lib/social/dispatcher";
import { prisma } from "@/lib/prisma";

const retrySchema = z.object({
  jobId: z.string().cuid(),
});

export async function retrySocialPostJobAction(formData: FormData): Promise<void> {
  try {
    await assertRole("ADMIN");

    const parsed = retrySchema.safeParse({
      jobId: formData.get("jobId"),
    });

    if (!parsed.success) {
      return;
    }

    const result = await prisma.$executeRaw`
      UPDATE "SocialPostJob"
      SET
        "status" = 'PENDING'::"SocialPostJobStatus",
        "error" = NULL,
        "retryCount" = 0,
        "updatedAt" = NOW()
      WHERE "id" = ${parsed.data.jobId}
    `;

    if (Number(result) <= 0) {
      return;
    }

    await dispatchSocialPostJobs({ limit: 1, maxRetryCount: 10 });

    revalidatePath("/dashboard/settings/social-dispatch");
    return;
  } catch (error) {
    console.error(error);
    return;
  }
}

export async function runSocialDispatchNowAction(): Promise<void> {
  try {
    await assertRole("ADMIN");

    await dispatchSocialPostJobs({ limit: 20, maxRetryCount: 10 });
    revalidatePath("/dashboard/settings/social-dispatch");

    return;
  } catch (error) {
    console.error(error);
    return;
  }
}
