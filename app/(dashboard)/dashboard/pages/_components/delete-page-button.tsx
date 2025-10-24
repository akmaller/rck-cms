"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deletePageAction } from "@/app/(dashboard)/dashboard/pages/actions";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

type DeletePageButtonProps = {
  pageId: string;
  pageTitle: string;
  redirectTo?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
};

export function DeletePageButton({
  pageId,
  pageTitle,
  redirectTo,
  size = "sm",
  variant = "destructive",
}: DeletePageButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(`Hapus halaman "${pageTitle}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deletePageAction(pageId);
      if (!result.success) {
        notifyError(result.message ?? "Gagal menghapus halaman.");
        return;
      }

      notifySuccess("Halaman berhasil dihapus.");
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? "Menghapus..." : "Hapus"}
    </Button>
  );
}
