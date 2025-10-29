"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { formatRelativeTime } from "@/lib/datetime/relative";
import { cn } from "@/lib/utils";
import type { ArticleComment } from "@/lib/comments/service";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";

import { CommentForm } from "./comment-form";
import { toggleCommentLikeAction } from "./actions";

type SerializableFields = Omit<ArticleComment, "createdAt" | "updatedAt" | "replies"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
  replies: SerializableFields[];
};

export type SerializableComment = SerializableFields;

type CommentThreadProps = {
  comment: SerializableComment;
  articleId: string;
  articleSlug: string;
  currentUserId?: string | null;
  currentUserName?: string;
  canReply?: boolean;
  forbiddenPhrases?: string[];
  depth?: number;
};

const MAX_REPLY_DEPTH = 1;
const commentLikeFormatter = new Intl.NumberFormat("id-ID");

function getInitialLetter(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "P";
  }
  return trimmed.charAt(0).toUpperCase();
}

export function CommentThread({
  comment,
  articleId,
  articleSlug,
  currentUserId,
  currentUserName,
  canReply = false,
  forbiddenPhrases = [],
  depth = 0,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [viewerHasLiked, setViewerHasLiked] = useState(comment.viewerHasLiked);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [isLiking, startLiking] = useTransition();
  const createdAtDate = useMemo(
    () => (comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt)),
    [comment.createdAt]
  );
  const relativeLabel = formatRelativeTime(createdAtDate);
  const authorName = comment.user?.name ?? "Pengunjung";
  const avatarUrl = comment.user?.avatarUrl ?? null;
  const initials = getInitialLetter(authorName);
  const isCurrentUser = currentUserId ? comment.userId === currentUserId : false;
  const profileHref = comment.user?.id ? `/authors/${comment.user.id}` : null;
  const allowReply = canReply && depth < MAX_REPLY_DEPTH;
  const router = useRouter();
  const loginRedirect = `/login?redirectTo=/articles/${articleSlug}#artikel-komentar`;
  const formattedLikeCount = useMemo(
    () => commentLikeFormatter.format(likeCount),
    [likeCount]
  );

  const handleToggleLike = () => {
    if (!currentUserId) {
      router.push(loginRedirect);
      return;
    }
    setLikeError(null);
    startLiking(() => {
      toggleCommentLikeAction(comment.id, articleSlug)
        .then((result) => {
          if (!result.success) {
            setLikeError(result.error ?? "Gagal memperbarui suka komentar.");
            return;
          }
          setViewerHasLiked(result.liked);
          setLikeCount(result.likeCount);
        })
        .catch((error) => {
          console.error("toggleCommentLikeAction failed", error);
          setLikeError("Gagal memperbarui suka komentar. Coba lagi.");
        });
    });
  };

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        "rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm transition-colors",
        isCurrentUser ? "border-primary/70 bg-primary/5" : "",
        depth > 0 ? "ml-6" : ""
      )}
      aria-label={`Komentar dari ${authorName}`}
    >
      <div className="flex gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`Foto ${authorName}`}
            width={40}
            height={40}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
            sizes="40px"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
        )}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {profileHref ? (
              <Link
                href={profileHref}
                className="font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {authorName}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{authorName}</span>
            )}
            <span aria-hidden>•</span>
            <time dateTime={createdAtDate.toISOString()}>{relativeLabel}</time>
            {isCurrentUser ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Komentar Anda
              </span>
            ) : null}
            {allowReply ? (
              <>
                <span aria-hidden>•</span>
                <button
                  type="button"
                  onClick={() => setIsReplying((prev) => !prev)}
                  className="font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {isReplying ? "Batal" : "Balas"}
                </button>
              </>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {comment.content}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={isLiking}
              aria-pressed={viewerHasLiked}
              aria-label={viewerHasLiked ? "Batalkan suka komentar" : "Suka komentar"}
              title={viewerHasLiked ? "Batalkan suka komentar" : "Suka komentar"}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                viewerHasLiked
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-primary",
                isLiking ? "opacity-70" : ""
              )}
            >
              <Heart
                className="h-3.5 w-3.5"
                aria-hidden="true"
                fill={viewerHasLiked ? "currentColor" : "none"}
              />
              <span>{formattedLikeCount}</span>
            </button>
            {likeError ? (
              <span className="text-xs font-medium text-destructive">{likeError}</span>
            ) : null}
          </div>
          {isReplying ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-card/80 p-3">
              <CommentForm
                articleId={articleId}
                slug={articleSlug}
                userName={currentUserName ?? "Anda"}
                forbiddenPhrases={forbiddenPhrases}
                parentId={comment.id}
                variant="reply"
                autoFocus
                onSuccess={() => setIsReplying(false)}
              />
            </div>
          ) : null}
          {comment.replies.length > 0 ? (
            <div className="space-y-3 border-l border-border/60 pl-4">
              {comment.replies.map((reply) => (
                <CommentThread
                  key={reply.id}
                  comment={reply}
                  articleId={articleId}
                  articleSlug={articleSlug}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  canReply={canReply}
                  forbiddenPhrases={forbiddenPhrases}
                  depth={depth + 1}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
