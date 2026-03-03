"use server";

import { auth } from "@/auth";
import { toggleAuthorFollow } from "@/lib/follows/service";

type ToggleFollowActionResult =
  | { success: true; following: boolean; followerCount: number }
  | { success: false; error: string };

export async function toggleFollowAuthorAction(authorId: string): Promise<ToggleFollowActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Silakan masuk untuk mengikuti penulis.",
    };
  }

  try {
    const result = await toggleAuthorFollow({
      authorId,
      followerId: session.user.id,
    });

    return {
      success: true,
      following: result.following,
      followerCount: result.followerCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SELF_FOLLOW_NOT_ALLOWED") {
        return { success: false, error: "Anda tidak bisa mengikuti akun sendiri." };
      }
      if (error.message === "TARGET_UNAVAILABLE") {
        return { success: false, error: "Profil penulis tidak ditemukan." };
      }
      if (error.message === "FOLLOW_TABLE_UNAVAILABLE") {
        return {
          success: false,
          error: "Fitur ikuti belum tersedia karena migrasi database belum dijalankan.",
        };
      }
    }

    console.error("Failed to toggle author follow", error);
    return { success: false, error: "Gagal memperbarui status ikuti. Coba lagi." };
  }
}
