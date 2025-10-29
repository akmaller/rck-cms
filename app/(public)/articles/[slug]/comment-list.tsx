import { type ArticleComment } from "@/lib/comments/service";

import { CommentThread, type SerializableComment } from "./comment-thread";

type CommentListProps = {
  comments: ArticleComment[];
  articleId: string;
  articleSlug: string;
  currentUserId?: string | null;
  currentUserName?: string | null;
  canReply?: boolean;
  forbiddenPhrases?: string[];
};

function serializeComment(comment: ArticleComment): SerializableComment {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replies: comment.replies.map(serializeComment),
  };
}

export function CommentList({
  comments,
  articleId,
  articleSlug,
  currentUserId,
  currentUserName,
  canReply = false,
  forbiddenPhrases = [],
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada komentar. Jadilah yang pertama memberi tanggapan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={serializeComment(comment)}
          articleId={articleId}
          articleSlug={articleSlug}
          currentUserId={currentUserId ?? null}
          currentUserName={currentUserName ?? undefined}
          canReply={Boolean(canReply && currentUserId)}
          forbiddenPhrases={forbiddenPhrases}
        />
      ))}
    </div>
  );
}
