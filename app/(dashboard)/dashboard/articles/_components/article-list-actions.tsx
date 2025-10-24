"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteArticle } from "@/components/forms/actions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type ArticleListActionsProps = {
  articleId: string;
  showDeleteOnly?: boolean;
};

export function ArticleListActions({ articleId, showDeleteOnly = false }: ArticleListActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm("Yakin ingin menghapus artikel ini? Tindakan ini tidak dapat dibatalkan.");
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteArticle(articleId);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  const deleteButton = (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className={cn(
        buttonVariants({ variant: "destructive", size: showDeleteOnly ? "icon" : "sm" }),
        showDeleteOnly
          ? "h-8 w-8 rounded-md border border-destructive/40 bg-destructive/10 hover:bg-destructive/20"
          : "border border-destructive/40"
      )}
      aria-label="Hapus artikel"
    >
      {isPending ? (
        <span className="text-[10px]">...</span>
      ) : (
        <Trash2 className="h-4 w-4" aria-hidden />
      )}
    </button>
  );

  if (showDeleteOnly) {
    return (
      <div className="flex flex-col items-center gap-1">
        {deleteButton}
        {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-[11px]">
      {deleteButton}
      {error ? <p className="basis-full text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
