'use client';

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/lib/button-variants";
import type { RoleKey } from "@/lib/auth/permissions";
import { formatRelativeTime } from "@/lib/datetime/relative";
import { notifySuccess, notifyWarning } from "@/lib/notifications/client";
import { cn } from "@/lib/utils";

import { deleteCommentAction, setCommentStatusAction, updateCommentAction } from "./actions";
import type { CommentListItem, CommentsView, CommentStatusValue } from "./types";

type CommentsCardProps = {
  comments: CommentListItem[];
  view: CommentsView;
  emptyMessage: string;
  pageSize?: number;
  currentUserId: string;
  currentRole: RoleKey;
};

const DEFAULT_PAGE_SIZE = 10;

const STATUS_LABEL: Record<CommentStatusValue, string> = {
  PUBLISHED: "Dipublikasikan",
  PENDING: "Menunggu",
  ARCHIVED: "Diarsipkan",
};

const STATUS_BADGE_VARIANT: Record<CommentStatusValue, "default" | "secondary" | "outline"> = {
  PUBLISHED: "default",
  PENDING: "secondary",
  ARCHIVED: "outline",
};

export function CommentsCard({
  comments,
  view,
  emptyMessage,
  pageSize = DEFAULT_PAGE_SIZE,
  currentUserId,
  currentRole,
}: CommentsCardProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isAdmin = currentRole === "ADMIN";
  const canModerate = currentRole === "ADMIN" || currentRole === "EDITOR";
  const actionButtonClass = "text-xs font-medium text-primary transition hover:text-primary/80 disabled:opacity-50";

  const handleStartEdit = (comment: CommentListItem) => {
    setEditingId(comment.id);
    setEditingValue(comment.content);
    setActionFeedback(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleSaveEdit = (comment: CommentListItem) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setActionFeedback({ type: "error", message: "Komentar tidak boleh kosong." });
      return;
    }

    startTransition(async () => {
      const result = await updateCommentAction({ commentId: comment.id, content: editingValue });
      if (!result.success) {
        setActionFeedback({ type: "error", message: result.message });
        return;
      }
      const movedToPending = result.status === "PENDING" && comment.status !== "PENDING";
      if (movedToPending && !isAdmin) {
        notifyWarning(
          "Komentar Anda diperbarui dan menunggu peninjauan sebelum dipublikasikan kembali.",
          "Menunggu Moderasi",
        );
      }
      setActionFeedback({
        type: "success",
        message: result.message ?? "Komentar berhasil diperbarui.",
      });
      setEditingId(null);
      setEditingValue("");
      router.refresh();
    });
  };

  const handleDelete = (commentId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Hapus komentar ini? Tindakan ini tidak dapat dibatalkan.");
      if (!confirmed) {
        return;
      }
    }

    startTransition(async () => {
      const result = await deleteCommentAction({ commentId });
      if (!result.success) {
        setActionFeedback({ type: "error", message: result.message });
        return;
      }
      setActionFeedback({
        type: "success",
        message: result.message ?? "Komentar berhasil dihapus.",
      });
      if (editingId === commentId) {
        setEditingId(null);
        setEditingValue("");
      }
      router.refresh();
    });
  };

  const handleSetStatus = (comment: CommentListItem, status: CommentStatusValue) => {
    if (!canModerate) return;
    if (comment.status === status) {
      setActionFeedback({
        type: "success",
        message: "Status komentar tidak berubah.",
      });
      return;
    }

    startTransition(async () => {
      const result = await setCommentStatusAction({ commentId: comment.id, status });
      if (!result.success) {
        setActionFeedback({ type: "error", message: result.message });
        return;
      }
      if ("status" in result && result.status !== comment.status) {
        notifySuccess(`Komentar ditandai sebagai ${STATUS_LABEL[result.status].toLowerCase()}.`);
      }
      setActionFeedback({
        type: "success",
        message: result.message ?? "Status komentar diperbarui.",
      });
      if (editingId === comment.id) {
        setEditingId(null);
        setEditingValue("");
      }
      router.refresh();
    });
  };

  const searchInputId = useId();
  const startDateId = `${searchInputId}-start`;
  const endDateId = `${searchInputId}-end`;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const startDateObj = useMemo(() => {
    if (!startDate) return null;
    const date = new Date(startDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [startDate]);

  const endDateExclusive = useMemo(() => {
    if (!endDate) return null;
    const date = new Date(endDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const exclusive = new Date(date.getTime());
    exclusive.setDate(exclusive.getDate() + 1);
    return exclusive;
  }, [endDate]);

  const hasActiveFilters =
    normalizedSearch.length > 0 || Boolean(startDateObj) || Boolean(endDateExclusive);

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => {
      const commentDate = new Date(comment.createdAt);
      if (Number.isNaN(commentDate.getTime())) {
        return false;
      }

      if (startDateObj && commentDate < startDateObj) {
        return false;
      }

      if (endDateExclusive && commentDate >= endDateExclusive) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const haystack = [
        comment.content,
        comment.articleTitle,
        comment.commenterName ?? "",
        comment.articleAuthorName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [comments, endDateExclusive, normalizedSearch, startDateObj]);

  const totalComments = filteredComments.length;
  const totalPages = Math.max(1, Math.ceil(totalComments / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startItem = totalComments === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem =
    totalComments === 0 ? 0 : Math.min(startItem + pageSize - 1, totalComments);

  const pageItems = filteredComments.slice(
    (safePage - 1) * pageSize,
    (safePage - 1) * pageSize + pageSize
  );

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  const handlePrevPage = () => setPage((current) => Math.max(current - 1, 1));
  const handleNextPage = () => setPage((current) => Math.min(current + 1, totalPages));

  return (
    <>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,_1fr)_repeat(2,180px)]">
            <div className="grid gap-1">
              <Label htmlFor={searchInputId}>Cari</Label>
              <Input
                id={searchInputId}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari komentar atau judul artikel..."
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={startDateId}>Dari tanggal</Label>
              <Input
                id={startDateId}
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={endDateId}>Sampai tanggal</Label>
              <Input
                id={endDateId}
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            {totalComments === 0
              ? "Tidak ada komentar yang cocok."
              : `Menampilkan ${startItem}-${endItem} dari ${totalComments} komentar.`}
          </span>
        </div>
        {actionFeedback ? (
          <p
            className={cn(
              "text-xs",
              actionFeedback.type === "success" ? "text-emerald-600" : "text-destructive",
            )}
          >
            {actionFeedback.message}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {pageItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            {comments.length === 0
              ? emptyMessage
              : hasActiveFilters
              ? "Tidak ada komentar yang cocok dengan filter saat ini."
              : emptyMessage}
          </p>
        ) : (
          <ul className="space-y-3">
            {pageItems.map((comment) => {
              const articleHref = comment.articleSlug
                ? `/articles/${comment.articleSlug}`
                : "#";
              const commenterName = comment.commenterName?.trim() || "Pengunjung";
              const showIdentity = view === "received" || view === "moderation";
              const isModerationView = view === "moderation";
              const isSelfComment = comment.commenterId === currentUserId;
              const canModify = isSelfComment || isAdmin;
              const shouldRightAlign = view === "received" && isSelfComment;
              const canShowActions = view === "authored" ? canModify : canModerate;
              const displayName = shouldRightAlign ? "Anda" : commenterName;
              const relativeLabel = formatRelativeTime(comment.createdAt) || "-";
              const isEdited = comment.updatedAt !== comment.createdAt;
              const editedLabelRaw = isEdited ? formatRelativeTime(comment.updatedAt) : "";
              const hasEditedLabel = Boolean(editedLabelRaw);
              const articleTitle = comment.articleTitle;
              const isEditing = editingId === comment.id;
              const initials =
                displayName
                  .split(" ")
                  .filter(Boolean)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")
                  .slice(0, 2) || "P";

              const avatarNode = (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                  {comment.commenterAvatarUrl ? (
                    <Image
                      src={comment.commenterAvatarUrl}
                      alt={`Foto ${displayName}`}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent text-sm font-semibold text-accent-foreground">
                      {initials}
                    </div>
                  )}
                </div>
              );

              return (
                <li
                  key={comment.id}
                  className="border-b border-border/60 pb-4 last:border-none last:pb-0"
                >
                  <div
                    className={cn(
                      "flex gap-3",
                      showIdentity ? "items-start" : "gap-0",
                      shouldRightAlign ? "justify-end" : ""
                    )}
                  >
                    {showIdentity && !shouldRightAlign ? avatarNode : null}
                    <div
                      className={cn(
                        "flex-1 space-y-2",
                        shouldRightAlign ? "ml-auto max-w-[75%] text-right" : "",
                        !showIdentity ? "text-left" : ""
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2",
                          showIdentity
                            ? shouldRightAlign
                              ? "justify-end text-sm"
                              : "text-sm"
                            : "text-xs text-muted-foreground",
                          shouldRightAlign ? "w-full" : "",
                          isModerationView ? "justify-between" : ""
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {showIdentity ? (
                            <>
                              <span className="font-medium text-foreground">{displayName}</span>
                              <span className="text-xs text-muted-foreground">- {relativeLabel}</span>
                              {hasEditedLabel ? (
                                <span className="text-xs text-muted-foreground">
                                  • Diedit {editedLabelRaw}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span>Dikirim {relativeLabel}</span>
                              {hasEditedLabel ? <span>• Diedit {editedLabelRaw}</span> : null}
                            </>
                          )}
                        </div>
                          {isModerationView ? (
                            <Badge variant={STATUS_BADGE_VARIANT[comment.status]}>
                              {STATUS_LABEL[comment.status]}
                            </Badge>
                          ) : null}
                      </div>
                      {isEditing ? (
                        <>
                          <Textarea
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            className="min-h-[120px] text-sm"
                            disabled={isPending}
                          />
                          <div
                            className={cn(
                              "flex flex-wrap items-center gap-3 text-xs",
                              shouldRightAlign ? "justify-end" : "",
                            )}
                          >
                            <button
                              type="button"
                              className={actionButtonClass}
                              onClick={handleCancelEdit}
                              disabled={isPending}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              className={actionButtonClass}
                              onClick={() => handleSaveEdit(comment)}
                              disabled={isPending}
                            >
                              Simpan
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p
                            className={cn(
                              "text-sm leading-relaxed text-foreground/90",
                              shouldRightAlign ? "text-right" : "",
                            )}
                          >
                            {comment.content}
                          </p>
                          {isModerationView && canModerate ? (
                            <div
                              className={cn(
                                "flex flex-wrap items-center gap-3 text-xs",
                                shouldRightAlign ? "justify-end" : "",
                              )}
                            >
                              <button
                                type="button"
                                className={actionButtonClass}
                                onClick={() => handleSetStatus(comment, "PENDING")}
                                disabled={isPending || comment.status === "PENDING"}
                              >
                                Tandai Pending
                              </button>
                              <button
                                type="button"
                                className={actionButtonClass}
                                onClick={() => handleSetStatus(comment, "PUBLISHED")}
                                disabled={isPending || comment.status === "PUBLISHED"}
                              >
                                Terbitkan
                              </button>
                              <button
                                type="button"
                                className={actionButtonClass}
                                onClick={() => handleSetStatus(comment, "ARCHIVED")}
                                disabled={isPending || comment.status === "ARCHIVED"}
                              >
                                Arsipkan
                              </button>
                            </div>
                          ) : null}
                          {canShowActions ? (
                            <div
                              className={cn(
                                "flex flex-wrap items-center gap-3 text-xs",
                                shouldRightAlign ? "justify-end" : "",
                              )}
                            >
                              <button
                                type="button"
                                className={actionButtonClass}
                                onClick={() => handleStartEdit(comment)}
                                disabled={isPending}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={actionButtonClass}
                                onClick={() => handleDelete(comment.id)}
                                disabled={isPending}
                              >
                                Hapus
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                      <div
                        className={cn(
                          "text-xs text-muted-foreground",
                          shouldRightAlign ? "text-right" : ""
                        )}
                      >
                        Artikel:{" "}
                        {comment.articleSlug ? (
                          <Link href={articleHref} className="hover:text-primary" prefetch={false}>
                            {articleTitle}
                          </Link>
                        ) : (
                          <span>{articleTitle}</span>
                        )}
                      </div>
                    </div>
                    {shouldRightAlign ? avatarNode : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalComments > 0 ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Halaman {safePage} dari {totalPages}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-[6rem]")}
                disabled={safePage <= 1}
              >
                Sebelumnya
              </button>
              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center gap-1">
                  {pageNumbers.map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setPage(number)}
                      className={cn(
                        buttonVariants({
                          variant: number === safePage ? "default" : "outline",
                          size: "sm",
                        }),
                        number === safePage ? "cursor-default" : ""
                      )}
                      aria-current={number === safePage ? "page" : undefined}
                      disabled={number === safePage}
                    >
                      {number}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleNextPage}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-[6rem]")}
                disabled={safePage >= totalPages}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </>
  );
}
