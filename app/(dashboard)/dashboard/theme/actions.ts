"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

type ThemePreference = "LIGHT" | "DARK";

export async function setThemePreference(theme: ThemePreference) {
  if (theme !== "LIGHT" && theme !== "DARK") {
    return { success: false, message: "Pilihan tema tidak dikenal." };
  }

  try {
    const session = await requireAuth();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { theme },
    });

    revalidatePath("/dashboard");

    return { success: true, theme };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal memperbarui preferensi tema." };
  }
}
