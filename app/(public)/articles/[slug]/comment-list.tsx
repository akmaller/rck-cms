import { type ArticleComment } from "@/lib/comments/service";
import { cn } from "@/lib/utils";

type CommentListProps = {
  comments: ArticleComment[];
  currentUserId?: string | null;
};

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getInitialLetter(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "P";
  }
  return [...trimmed][0]?.toUpperCase() ?? "P";
}

export function CommentList({ comments, currentUserId }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada komentar. Jadilah yang pertama memberi tanggapan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const createdAt = comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt);
        const authorName = comment.user?.name ?? "Pengunjung";
        const isCurrentUser = currentUserId ? comment.userId === currentUserId : false;
        const initials = getInitialLetter(authorName);

        return (
          <article
            key={comment.id}
            className={cn(
              "rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm transition-colors",
              isCurrentUser ? "border-primary/70 bg-primary/5" : ""
            )}
            aria-label={`Komentar dari ${authorName}`}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{authorName}</span>
                  <span aria-hidden>•</span>
                  <time dateTime={createdAt.toISOString()}>{timeFormatter.format(createdAt)}</time>
                  {isCurrentUser ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Komentar Anda
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {comment.content}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
