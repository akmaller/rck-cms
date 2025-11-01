"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArticleStatus } from "@prisma/client";

import { bulkUpdateArticleStatus } from "@/components/forms/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { ArticleListActions } from "./article-list-actions";

type ArticleListItem = {
  id: string;
  title: string;
  status: ArticleStatus;
  authorName: string | null;
  publishedAt: string | null;
  categories: string[];
  viewCount: number;
  publicUrl: string;
  editUrl: string;
};

type ArticleBulkListProps = {
  articles: ArticleListItem[];
  isAuthor: boolean;
  hasFilters: boolean;
};

export function ArticleBulkList({ articles, isAuthor, hasFilters }: ArticleBulkListProps) {
  const router = useRouter();
  const [rawSelectedIds, setRawSelectedIds] = useState<string[]>([]);

const articleIdSet = useMemo(() => new Set(articles.map(a => a.id)), [articles]);
const selectedIds = useMemo(() => rawSelectedIds.filter(id => articleIdSet.has(id)), [rawSelectedIds, articleIdSet]);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const allIds = useMemo(() => articles.map((article) => article.id), [articles]);
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const selectedCount = selectedIds.length;

  const numberFormatter = useMemo(() => new Intl.NumberFormat("id-ID"), []);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat("id-ID"), []);

  const toggleSelection = (articleId: string) => {
    setFeedback(null);
    setRawSelectedIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  const toggleSelectAll = () => {
    setFeedback(null);
    setRawSelectedIds((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  const handleBulkAction = (intent: "publish" | "draft") => {
    if (selectedIds.length === 0) {
      setFeedback({ type: "error", message: "Pilih setidaknya satu artikel terlebih dahulu." });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      selectedIds.forEach((id) => formData.append("articleIds", id));
      formData.set("intent", intent);
      const result = await bulkUpdateArticleStatus(formData);

      if (!result || typeof result !== "object") {
        setFeedback({ type: "error", message: "Gagal memperbarui status artikel. Coba lagi." });
        return;
      }

      if ("error" in result && result.error) {
        const errorMessage =
          (typeof result.error === "string" && result.error.length > 0)
            ? result.error
            : "Gagal memperbarui status artikel. Coba lagi.";
        setFeedback({ type: "error", message: errorMessage });
        return;
      }

      if (!("status" in result) || !("updated" in result)) {
        setFeedback({ type: "error", message: "Respons tidak valid dari server." });
        return;
      }

      const payload = result as { status: ArticleStatus; updated: number };
      const successMessage =
        payload.status === ArticleStatus.PUBLISHED
          ? `${payload.updated} artikel berhasil dipublikasikan.`
          : `${payload.updated} artikel dipindahkan ke draf.`;

      setFeedback({ type: "success", message: successMessage });
      setRawSelectedIds([]);
      router.refresh();
    });
  };

  const clearSelection = () => {
    setFeedback(null);
    setRawSelectedIds([]);
  };

  if (articles.length === 0) {
    return (
      <div className="space-y-3">
        {feedback ? (
          <p
            className={cn(
              "text-xs",
              feedback.type === "success" ? "text-emerald-600" : "text-destructive"
            )}
          >
            {feedback.message}
          </p>
        ) : null}
        {hasFilters ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada artikel yang cocok dengan kriteria Anda.
          </p>
        ) : isAuthor ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border/60 bg-muted/10 p-4">
            <p className="text-sm text-muted-foreground">Anda belum memiliki artikel.</p>
            <Link href="/dashboard/articles/new" className={cn(buttonVariants({ size: "sm" }))}>
              Tulis artikel sekarang
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada artikel. Mulai dengan membuat artikel baru.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-border accent-primary"
            checked={allSelected}
            onChange={toggleSelectAll}
            aria-label="Pilih semua artikel pada halaman ini"
          />
          <span>
            {selectedCount > 0
              ? `${selectedCount} artikel dipilih`
              : "Tidak ada artikel yang dipilih"}
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ size: "sm" }), "whitespace-nowrap")}
            onClick={() => handleBulkAction("publish")}
            disabled={isPending || selectedCount === 0}
          >
            Publikasikan
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "whitespace-nowrap")}
            onClick={() => handleBulkAction("draft")}
            disabled={isPending || selectedCount === 0}
          >
            Jadikan Draf
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "whitespace-nowrap")}
            onClick={clearSelection}
            disabled={isPending || selectedCount === 0}
          >
            Bersihkan
          </button>
        </div>
      </div>
      {feedback ? (
        <p
          className={cn(
            "text-xs",
            feedback.type === "success" ? "text-emerald-600" : "text-destructive"
          )}
        >
          {feedback.message}
        </p>
      ) : null}
      {articles.map((article) => {
        const isChecked = selectedIds.includes(article.id);
        const publishedAt = article.publishedAt
          ? dateFormatter.format(new Date(article.publishedAt))
          : "-";
        const viewCountLabel = `${numberFormatter.format(article.viewCount)} tampilan unik`;
        return (
          <div
            key={article.id}
            className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-primary/5"
          >
            <div className="pt-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-border accent-primary"
                checked={isChecked}
                onChange={() => toggleSelection(article.id)}
                aria-label={`Pilih artikel ${article.title}`}
              />
            </div>
            <Link href={article.editUrl} className="flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-foreground">{article.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{article.status}</Badge>
                  <span>{article.authorName ?? "Anonim"}</span>
                  <span>{publishedAt}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground/80">•</span>
                    {viewCountLabel}
                  </span>
                  {article.categories.length ? (
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground/80">•</span>
                      {article.categories.join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
            <ArticleListActions
              articleId={article.id}
              showDeleteOnly
              publicUrl={article.publicUrl}
              editUrl={article.editUrl}
            />
          </div>
        );
      })}
    </div>
  );
}
