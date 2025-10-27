"use server";

import { auth } from "@/auth";
import { sanitizeCommentContent } from "@/lib/comments/service";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { COMMENT_STATUS } from "./types";
import type { CommentStatusValue } from "./types";

type UpdateActionResult =
  | {
      success: true;
      status: CommentStatusValue;
      previousStatus: CommentStatusValue;
      message?: string;
    }
  | { success: false; message: string };

type DeleteActionResult =
  | { success: true; message?: string }
  | { success: false; message: string };

type ModerateActionResult =
  | { success: true; status: CommentStatusValue; previousStatus: CommentStatusValue; message?: string }
  | { success: false; message: string };

async function resolveSession() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  return { session, userId, role };
}

export async function updateCommentAction(params: { commentId: string; content: string }): Promise<UpdateActionResult> {
  const { commentId, content } = params;
  if (!commentId || typeof commentId !== "string") {
    return { success: false, message: "Komentar tidak ditemukan." };
  }

  const { userId, role } = await resolveSession();
  if (!userId) {
    return { success: false, message: "Anda harus masuk untuk mengedit komentar." };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      status: true,
      article: { select: { authorId: true } },
    },
  });

  if (!comment) {
    return { success: false, message: "Komentar tidak ditemukan atau sudah dihapus." };
  }

  const isOwner = comment.userId === userId;
  const isAdmin = role === "ADMIN";
  const isEditorManagingArticle = role === "EDITOR" && comment.article?.authorId === userId;
  if (!isOwner && !isAdmin && !isEditorManagingArticle) {
    return { success: false, message: "Anda tidak memiliki akses untuk mengedit komentar ini." };
  }

  const sanitizedContent = sanitizeCommentContent(content ?? "");
  if (!sanitizedContent.trim()) {
    return { success: false, message: "Komentar tidak boleh kosong." };
  }

  const currentStatus = comment.status as CommentStatusValue;
  const nextStatus: CommentStatusValue =
    isAdmin || isEditorManagingArticle ? currentStatus : COMMENT_STATUS.PENDING;

  await prisma.comment.update({
    where: { id: comment.id },
    data: {
      content: sanitizedContent,
      status: nextStatus,
    },
  });

  const baseResult = {
    success: true as const,
    status: nextStatus,
    previousStatus: currentStatus,
  };

  await writeAuditLog({
    action: "comment.update",
    entity: "Comment",
    entityId: comment.id,
    metadata: {
      previousStatus: currentStatus,
      status: nextStatus,
      isAdmin: isAdmin || isEditorManagingArticle,
      editorManaged: isEditorManagingArticle,
    },
  });

  return {
    ...baseResult,
    message:
      isAdmin || isEditorManagingArticle
        ? "Komentar berhasil diperbarui."
        : "Komentar diperbarui dan menunggu peninjauan sebelum dipublikasikan kembali.",
  };
}

export async function deleteCommentAction(params: { commentId: string }): Promise<DeleteActionResult> {
  const { commentId } = params;
  if (!commentId || typeof commentId !== "string") {
    return { success: false, message: "Komentar tidak ditemukan." };
  }

  const { userId, role } = await resolveSession();
  if (!userId) {
    return { success: false, message: "Anda harus masuk untuk menghapus komentar." };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      article: { select: { authorId: true } },
    },
  });

  if (!comment) {
    return { success: false, message: "Komentar tidak ditemukan atau sudah dihapus." };
  }

  const isOwner = comment.userId === userId;
  const isAdmin = role === "ADMIN";
  const isEditorManagingArticle = role === "EDITOR" && comment.article?.authorId === userId;
  if (!isOwner && !isAdmin && !isEditorManagingArticle) {
    return { success: false, message: "Anda tidak memiliki akses untuk menghapus komentar ini." };
  }

  await prisma.comment.delete({ where: { id: comment.id } });

  await writeAuditLog({
    action: "comment.delete",
    entity: "Comment",
    entityId: comment.id,
    metadata: {
      isAdmin: isAdmin || isEditorManagingArticle,
      editorManaged: isEditorManagingArticle,
    },
  });

  return { success: true, message: "Komentar berhasil dihapus." };
}

export async function setCommentStatusAction(params: { commentId: string; status: CommentStatusValue }): Promise<ModerateActionResult> {
  const { commentId, status } = params;
  if (!commentId || typeof commentId !== "string") {
    return { success: false, message: "Komentar tidak ditemukan." };
  }

  if (!Object.values(COMMENT_STATUS).includes(status)) {
    return { success: false, message: "Status komentar tidak valid." };
  }

  const { userId, role } = await resolveSession();
  if (!userId || (role !== "ADMIN" && role !== "EDITOR")) {
    return { success: false, message: "Anda tidak memiliki akses untuk memoderasi komentar." };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true },
  });

  if (!comment) {
    return { success: false, message: "Komentar tidak ditemukan atau sudah dihapus." };
  }

  if (comment.status === status) {
    return {
      success: true,
      status,
      previousStatus: comment.status as CommentStatusValue,
      message: "Status komentar tidak berubah.",
    };
  }

  await prisma.comment.update({
    where: { id: comment.id },
    data: { status },
  });

  await writeAuditLog({
    action: "comment.moderate",
    entity: "Comment",
    entityId: comment.id,
    metadata: {
      previousStatus: comment.status,
      status,
    },
  });

  const message =
    status === COMMENT_STATUS.PUBLISHED
      ? "Komentar diterbitkan."
      : status === COMMENT_STATUS.PENDING
        ? "Komentar ditandai menunggu moderasi."
        : "Komentar diarsipkan.";

  return {
    success: true,
    status,
    previousStatus: comment.status as CommentStatusValue,
    message,
  };
}
