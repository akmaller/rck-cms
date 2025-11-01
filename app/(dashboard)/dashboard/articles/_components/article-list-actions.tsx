"use client";

import Link from "next/link";
import { ExternalLink, PencilLine, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteArticle } from "@/components/forms/actions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type ArticleListActionsProps = {
  articleId: string;
  showDeleteOnly?: boolean;
  publicUrl?: string;
  editUrl?: string;
};

export function ArticleListActions({
  articleId,
  showDeleteOnly = false,
  publicUrl,
  editUrl,
}: ArticleListActionsProps) {
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

  const iconClass = showDeleteOnly
    ? "h-4 w-4 text-destructive"
    : "h-4 w-4 text-destructive-foreground";

  const viewButton = publicUrl
    ? showDeleteOnly
      ? (
          <Link
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-8 w-8 rounded-md border border-border/60 bg-background hover:bg-accent"
            )}
            aria-label="Lihat halaman publik"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        )
      : (
          <Link
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "text-xs")}
          >
            Lihat Publik
          </Link>
        )
    : null;

  const editButton = editUrl
    ? showDeleteOnly
      ? (
          <Link
            href={editUrl}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-8 w-8 rounded-md border border-border/60 bg-background hover:bg-accent"
            )}
            aria-label="Edit artikel"
          >
            <PencilLine className="h-4 w-4" aria-hidden />
          </Link>
        )
      : (
          <Link
            href={editUrl}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
          >
            Edit
          </Link>
        )
    : null;

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
        <Trash2 className={iconClass} aria-hidden />
      )}
    </button>
  );

  if (showDeleteOnly) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          {editButton}
          {viewButton}
          {deleteButton}
        </div>
        {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-[11px]">
      {editButton}
      {viewButton}
      {deleteButton}
      {error ? <p className="basis-full text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
