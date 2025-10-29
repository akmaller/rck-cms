"use server";

import { revalidatePath } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { createForbiddenTerm, deleteForbiddenTerm } from "@/lib/moderation/forbidden-terms";

type AddTermActionResult =
  | {
      success: true;
      term: {
        id: string;
        phrase: string;
        createdAt: string;
        createdByName: string | null;
      };
    }
  | { success: false; message: string };

type DeleteTermActionResult =
  | { success: true; id: string }
  | { success: false; message: string };

export async function addForbiddenTermAction(formData: FormData): Promise<AddTermActionResult> {
  const session = await assertRole("ADMIN");
  const phraseValue = formData.get("phrase");

  if (typeof phraseValue !== "string") {
    return { success: false, message: "Kata atau kalimat tidak valid." };
  }

  const result = await createForbiddenTerm({
    phrase: phraseValue,
    createdById: session.user.id,
  });

  if (!result.ok) {
    return { success: false, message: result.error };
  }

  revalidatePath("/dashboard/settings/moderation");
  return {
    success: true,
    term: {
      id: result.term.id,
      phrase: result.term.phrase,
      createdAt: result.term.createdAt.toISOString(),
      createdByName: result.term.createdBy?.name ?? null,
    },
  };
}

export async function deleteForbiddenTermAction(termId: string): Promise<DeleteTermActionResult> {
  await assertRole("ADMIN");
  if (!termId || typeof termId !== "string") {
    return { success: false, message: "Data tidak valid." };
  }

  const removed = await deleteForbiddenTerm(termId);
  if (!removed) {
    return { success: false, message: "Istilah mungkin sudah dihapus atau tidak ditemukan." };
  }

  revalidatePath("/dashboard/settings/moderation");
  return { success: true, id: termId };
}
