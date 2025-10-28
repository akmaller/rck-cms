export const USER_DELETE_TARGET_ANON = "ANON" as const;

export type DeleteUserTransferTarget = string;

export type DeleteUserCommentStrategy =
  | { mode: "delete" }
  | { mode: "transfer"; targetUserId: DeleteUserTransferTarget };

export type DeleteUserArticleStrategy =
  | { mode: "delete" }
  | { mode: "transfer"; targetUserId: DeleteUserTransferTarget };

export type DeleteUserOptions = {
  commentStrategy: DeleteUserCommentStrategy;
  articleStrategy: DeleteUserArticleStrategy;
};
