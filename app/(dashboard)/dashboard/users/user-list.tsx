"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

import { deleteUserAction } from "./actions";

type UserListEntry = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type UserListProps = {
  users: UserListEntry[];
  currentUserId: string;
};

export function UserList({ users, currentUserId }: UserListProps) {
  const router = useRouter();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const handleRowClick = (userId: string) => {
    router.push(`/dashboard/users/${userId}`);
  };

  const handleDelete = (userId: string) => {
    const confirmMessage =
      "Hapus pengguna ini? Artikel pengguna akan dialihkan ke akun Anda.";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    startDeleting(async () => {
      setPendingDeleteId(userId);
      const result = await deleteUserAction(userId);
      if (!result.success) {
        notifyError(result.message ?? "Gagal menghapus pengguna.");
        setPendingDeleteId(null);
        return;
      }
      notifySuccess("Pengguna dihapus.");
      setPendingDeleteId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const createdAt = new Date(user.createdAt).toLocaleDateString("id-ID");
        const isOwnAccount = user.id === currentUserId;
        return (
          <div
            key={user.id}
            role="button"
            tabIndex={0}
            onClick={() => handleRowClick(user.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleRowClick(user.id);
              }
            }}
            className="group flex cursor-pointer items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {user.email} • {user.role}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{createdAt}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/dashboard/users/${user.id}`);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isOwnAccount || (isDeleting && pendingDeleteId === user.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isOwnAccount) {
                    notifyError("Tidak dapat menghapus akun Anda sendiri.");
                    return;
                  }
                  handleDelete(user.id);
                }}
              >
                {isDeleting && pendingDeleteId === user.id ? "Menghapus..." : "Hapus"}
              </Button>
            </div>
          </div>
        );
      })}
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
      ) : null}
    </div>
  );
}
