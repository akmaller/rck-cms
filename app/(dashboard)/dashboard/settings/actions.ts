"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { siteConfigSchema } from "@/lib/validators/config";

export async function clearCacheAction() {
  try {
    await assertRole(["EDITOR", "ADMIN"]);
    revalidateTag("content");
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath("/sitemap.xml");
    revalidatePath("/rss.xml");
    return { success: true, message: "Cache halaman publik berhasil dibersihkan." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal membersihkan cache." };
  }
}

type BackupPayload = {
  siteConfig?: Record<string, unknown>;
};

export async function importBackupAction(formData: FormData) {
  try {
    await assertRole("ADMIN");
    const file = formData.get("backupFile");
    if (!(file instanceof File)) {
      return { success: false, message: "File backup tidak ditemukan." };
    }

    const text = await file.text();
    let payload: BackupPayload;
    try {
      payload = JSON.parse(text) as BackupPayload;
    } catch {
      return { success: false, message: "Format backup tidak valid." };
    }

    const generalConfig = payload?.siteConfig;
    if (generalConfig) {
      const parsed = siteConfigSchema.safeParse(generalConfig);
      if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Data backup tidak valid." };
      }

      await prisma.siteConfig.upsert({
        where: { key: "general" },
        update: { value: parsed.data },
        create: { key: "general", value: parsed.data },
      });

      await prisma.auditLog.create({
        data: {
          action: "CONFIG_IMPORT",
          entity: "SiteConfig",
          entityId: "general",
          metadata: { importedFields: Object.keys(parsed.data) },
        },
      });

      revalidateTag("site-config");
      revalidatePath("/dashboard/settings");
      revalidatePath("/dashboard");
    }

    return {
      success: true,
      message: generalConfig
        ? "Backup berhasil diimpor dan konfigurasi diperbarui."
        : "Backup terbaca, namun tidak ada konfigurasi yang diperbarui.",
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal mengimpor backup." };
  }
}
