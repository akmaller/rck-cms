"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  USER_DELETE_TARGET_ANON,
  type DeleteUserOptions,
} from "./delete-user-types";

type BasicUser = {
  id: string;
  name: string;
  email: string;
};

type UserDeleteDialogProps = {
  open: boolean;
  user: BasicUser | null;
  currentUserId: string;
  availableUsers: BasicUser[];
  onClose: () => void;
  onConfirm: (options: DeleteUserOptions) => void;
  isSubmitting: boolean;
};

type Step = "options" | "confirm";

export function UserDeleteDialog({
  open,
  user,
  currentUserId,
  availableUsers,
  onClose,
  onConfirm,
  isSubmitting,
}: UserDeleteDialogProps) {
  const [step, setStep] = useState<Step>("options");

  const dialogUser = user;

  const otherUsers = useMemo(() => {
    if (!dialogUser) return availableUsers;
    return availableUsers.filter((candidate) => candidate.id !== dialogUser.id);
  }, [availableUsers, dialogUser]);
  const defaultTarget = useMemo(() => {
    return (
      otherUsers.find((candidate) => candidate.id === currentUserId)?.id ??
      otherUsers[0]?.id ??
      USER_DELETE_TARGET_ANON
    );
  }, [otherUsers, currentUserId]);

  const [commentMode, setCommentMode] = useState<"delete" | "transfer">("transfer");
  const [commentTarget, setCommentTarget] = useState<string>(() => defaultTarget);
  const [articleMode, setArticleMode] = useState<"delete" | "transfer">("transfer");
  const [articleTarget, setArticleTarget] = useState<string>(() => defaultTarget);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, isSubmitting]);

  if (!open || !dialogUser) {
    return null;
  }

  const disableNext =
    (commentMode === "transfer" && !commentTarget) ||
    (articleMode === "transfer" && !articleTarget);

  const commentSummary =
    commentMode === "delete"
      ? "Hapus semua komentar pengguna ini."
      : commentTarget === USER_DELETE_TARGET_ANON
        ? "Alihkan komentar ke pengguna anonim."
        : `Alihkan komentar ke ${otherUsers.find((candidate) => candidate.id === commentTarget)?.name ?? "pengguna lain"}.`;

  const articleSummary =
    articleMode === "delete"
      ? "Hapus semua artikel pengguna ini."
      : articleTarget === USER_DELETE_TARGET_ANON
        ? "Alihkan artikel ke pengguna anonim."
        : `Alihkan artikel ke ${otherUsers.find((candidate) => candidate.id === articleTarget)?.name ?? "pengguna lain"}.`;

  const handleSubmitOptions = () => {
    if (disableNext) return;
    setStep("confirm");
  };

  const handleConfirm = () => {
    const options: DeleteUserOptions = {
      commentStrategy:
        commentMode === "delete"
          ? { mode: "delete" }
          : { mode: "transfer", targetUserId: commentTarget || USER_DELETE_TARGET_ANON },
      articleStrategy:
        articleMode === "delete"
          ? { mode: "delete" }
          : { mode: "transfer", targetUserId: articleTarget || USER_DELETE_TARGET_ANON },
    };
    onConfirm(options);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-3 py-6 backdrop-blur">
      <div className="w-full max-w-3xl rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="border-b border-border/60 px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {step === "options" ? "Hapus Pengguna" : "Konfirmasi Penghapusan"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {step === "options"
              ? `Tentukan bagaimana komentar dan artikel milik ${dialogUser.name} akan ditangani.`
              : "Pastikan pilihan Anda sudah benar sebelum melanjutkan."}
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4 text-sm text-foreground/90">
          {step === "options" ? (
            <div className="space-y-6">
              <section className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-foreground">Komentar</h3>
                <label className="flex items-start gap-3 rounded-md border border-border/60 bg-background p-3">
                  <input
                    type="radio"
                    name="comment-mode"
                    value="transfer"
                    checked={commentMode === "transfer"}
                    onChange={() => setCommentMode("transfer")}
                  />
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Alihkan komentar</span>
                    <p className="text-xs text-muted-foreground">
                      Pastikan percakapan tetap utuh dengan mengalihkan komentar ke pengguna lain
                      atau akun anonim.
                    </p>
                    {commentMode === "transfer" ? (
                      <select
                        value={commentTarget}
                        onChange={(event) => setCommentTarget(event.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {otherUsers.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ({candidate.email})
                          </option>
                        ))}
                        <option value={USER_DELETE_TARGET_ANON}>Alihkan ke akun anonim</option>
                      </select>
                    ) : null}
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border/60 bg-background p-3">
                  <input
                    type="radio"
                    name="comment-mode"
                    value="delete"
                    checked={commentMode === "delete"}
                    onChange={() => setCommentMode("delete")}
                  />
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-foreground">Hapus komentar</span>
                    <p className="text-xs text-muted-foreground">
                      Komentar akan dihapus permanen dan tidak dapat dipulihkan.
                    </p>
                  </div>
                </label>
              </section>

              <section className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-foreground">Artikel</h3>
                <label className="flex items-start gap-3 rounded-md border border-border/60 bg-background p-3">
                  <input
                    type="radio"
                    name="article-mode"
                    value="transfer"
                    checked={articleMode === "transfer"}
                    onChange={() => setArticleMode("transfer")}
                  />
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Alihkan artikel</span>
                    <p className="text-xs text-muted-foreground">
                      Pilih pengguna lain atau akun anonim untuk meneruskan kepemilikan artikel.
                    </p>
                    {articleMode === "transfer" ? (
                      <select
                        value={articleTarget}
                        onChange={(event) => setArticleTarget(event.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {otherUsers.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ({candidate.email})
                          </option>
                        ))}
                        <option value={USER_DELETE_TARGET_ANON}>Alihkan ke akun anonim</option>
                      </select>
                    ) : null}
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border/60 bg-background p-3">
                  <input
                    type="radio"
                    name="article-mode"
                    value="delete"
                    checked={articleMode === "delete"}
                    onChange={() => setArticleMode("delete")}
                  />
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-foreground">Hapus artikel</span>
                    <p className="text-xs text-muted-foreground">
                      Semua artikel pengguna akan dihapus permanen beserta datanya.
                    </p>
                  </div>
                </label>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pengguna <span className="font-semibold text-foreground">{dialogUser.name}</span>{" "}
                ({dialogUser.email}) akan dihapus. Berikut penanganan yang telah dipilih:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                  <span className="font-medium text-foreground">Komentar:</span>{" "}
                  <span className="text-muted-foreground">{commentSummary}</span>
                </li>
                <li className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                  <span className="font-medium text-foreground">Artikel:</span>{" "}
                  <span className="text-muted-foreground">{articleSummary}</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Penghapusan akun bersifat permanen. Tindakan ini akan dicatat pada log aktivitas.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          {step === "options" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSubmitOptions}
                disabled={disableNext || isSubmitting}
              >
                Lanjutkan
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("options")}
                disabled={isSubmitting}
              >
                Kembali
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Menghapus..." : "Konfirmasi Penghapusan"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
