"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatRelativeTime } from "@/lib/datetime/relative";
import { cn } from "@/lib/utils";
import type { ArticleComment } from "@/lib/comments/service";

import { CommentForm } from "./comment-form";

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

  return (
    <article
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
