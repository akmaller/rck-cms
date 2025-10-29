"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ArticleListEntry } from "@/lib/articles/list";

import { ArticleListCard } from "./article-list-card";

type RequestConfig =
  | { mode: "category"; slug: string }
  | { mode: "tag"; slug: string }
  | { mode: "search"; query: string }
  | { mode: "author"; authorId: string };

type ArticleLoadMoreListProps = {
  initialArticles: ArticleListEntry[];
  totalCount: number;
  loadSize: number;
  request: RequestConfig;
  emptyState?: React.ReactNode;
};

export function ArticleLoadMoreList({
  initialArticles,
  totalCount,
  loadSize,
  request,
  emptyState,
}: ArticleLoadMoreListProps) {
  const [articles, setArticles] = useState<ArticleListEntry[]>(initialArticles);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMore = articles.length < totalCount;

  const handleLoadMore = () => {
    if (!hasMore || isPending) return;
    startTransition(async () => {
      setError(null);
      const params = new URLSearchParams({
        mode: request.mode,
        offset: String(articles.length),
        limit: String(loadSize),
      });
      if ("slug" in request) {
        params.set("slug", request.slug);
      }
      if ("query" in request) {
        params.set("q", request.query);
      }
      if ("authorId" in request) {
        params.set("authorId", request.authorId);
      }

      const response = await fetch(`/api/public/articles/list?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setError("Gagal memuat artikel. Coba lagi sebentar lagi.");
        return;
      }

      const data = (await response.json()) as { items: ArticleListEntry[] };
      setArticles((prev) => [...prev, ...data.items]);
    });
  };

  if (articles.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleListCard
          key={article.id}
          href={`/articles/${article.slug}`}
          title={article.title}
          excerpt={article.excerpt}
          publishedAt={article.publishedAt}
          authorName={article.authorName}
          authorAvatarUrl={article.authorAvatarUrl}
          category={article.category}
          image={article.image}
        />
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {hasMore ? (
        <Button onClick={handleLoadMore} disabled={isPending} variant="outline">
          {isPending ? "Memuat..." : "Load More"}
        </Button>
      ) : null}
    </div>
  );
}
