"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

import { toggleArticleLikeAction } from "./actions";

type ArticleLikeButtonProps = {
  articleId: string;
  slug: string;
  initialLikeCount: number;
  initialViewerHasLiked: boolean;
  isAuthenticated: boolean;
};

const likeCountFormatter = new Intl.NumberFormat("id-ID");

export function ArticleLikeButton({
  articleId,
  slug,
  initialLikeCount,
  initialViewerHasLiked,
  isAuthenticated,
}: ArticleLikeButtonProps) {
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [viewerHasLiked, setViewerHasLiked] = useState(initialViewerHasLiked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formattedLikeCount = useMemo(
    () => likeCountFormatter.format(likeCount),
    [likeCount]
  );

  const loginRedirect = `/login?redirectTo=/articles/${slug}#artikel-komentar`;
  const buttonLabel = viewerHasLiked ? "Batalkan suka artikel" : "Suka artikel";

  const handleToggle = () => {
    if (!isAuthenticated) {
      router.push(loginRedirect);
      return;
    }

    setError(null);
    startTransition(() => {
      toggleArticleLikeAction(articleId, slug)
        .then((result) => {
          if (result.success) {
            setViewerHasLiked(result.liked);
            setLikeCount(result.likeCount);
            return;
          }
          setError(result.error ?? "Gagal memperbarui suka artikel.");
        })
        .catch((caught) => {
          console.error("toggleArticleLikeAction failed", caught);
          setError("Gagal memperbarui suka artikel. Coba lagi.");
        });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={viewerHasLiked}
        aria-label={buttonLabel}
        title={buttonLabel}
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          viewerHasLiked
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-border/70 text-muted-foreground hover:border-primary/60 hover:text-primary",
          isPending ? "opacity-80" : ""
        )}
      >
        <Heart
          className="h-4 w-4"
          aria-hidden="true"
          fill={viewerHasLiked ? "currentColor" : "none"}
        />
        <span>Suka</span>
        <span className="text-xs font-medium text-muted-foreground">
          {formattedLikeCount}
        </span>
      </button>
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
    </div>
  );
}
