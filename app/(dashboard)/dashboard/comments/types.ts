export const COMMENT_STATUS = {
  PUBLISHED: "PUBLISHED",
  PENDING: "PENDING",
  ARCHIVED: "ARCHIVED",
} as const;

export type CommentStatusValue = (typeof COMMENT_STATUS)[keyof typeof COMMENT_STATUS];

export type CommentsView = "received" | "authored" | "moderation";

export type CommentListItem = {
  id: string;
  content: string;
  status: CommentStatusValue;
  createdAt: string;
  updatedAt: string;
  articleTitle: string;
  articleSlug: string | null;
  articleAuthorName: string | null;
  commenterName: string | null;
  commenterAvatarUrl: string | null;
  commenterId: string | null;
};
