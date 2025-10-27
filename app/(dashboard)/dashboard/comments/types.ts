import type { CommentStatus } from "@prisma/client";

export type CommentsView = "received" | "authored" | "moderation";

export type CommentListItem = {
  id: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
  articleTitle: string;
  articleSlug: string | null;
  articleAuthorName: string | null;
  commenterName: string | null;
  commenterAvatarUrl: string | null;
  commenterId: string | null;
};
