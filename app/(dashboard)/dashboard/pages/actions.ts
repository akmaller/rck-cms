"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export async function deletePageAction(pageId: string) {
  try {
    const session = await assertRole(["EDITOR", "ADMIN"]);

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, slug: true, title: true },
    });

    if (!page) {
      return { success: false, message: "Halaman tidak ditemukan." };
    }

    await prisma.page.delete({ where: { id: pageId } });

    await writeAuditLog({
      action: "PAGE_DELETE",
      entity: "Page",
      entityId: pageId,
      metadata: { title: page.title, deletedBy: session.user.id },
    });

    revalidateTag("content");
    revalidatePath("/dashboard/pages");
    if (page.slug) {
      revalidatePath(`/pages/${page.slug}`);
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal menghapus halaman." };
  }
}
