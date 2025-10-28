"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

import { deleteUserAction } from "./actions";
import type { DeleteUserOptions } from "./delete-user-types";
import { UserDeleteDialog } from "./user-delete-dialog";

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
  availableUsers: Array<{ id: string; name: string; email: string }>;
  emptyMessage?: string;
};

export function UserList({ users, currentUserId, availableUsers, emptyMessage }: UserListProps) {
  const router = useRouter();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [dialogUser, setDialogUser] = useState<UserListEntry | null>(null);

  const handleRowClick = (userId: string) => {
    router.push(`/dashboard/users/${userId}`);
  };

  const closeDialog = () => {
    if (isDeleting) return;
    setDialogUser(null);
  };

  const initiateDelete = (user: UserListEntry) => {
    setDialogUser(user);
  };

  const handleConfirmDelete = (user: UserListEntry, options: DeleteUserOptions) => {
    startDeleting(async () => {
      setPendingDeleteId(user.id);
      const result = await deleteUserAction(user.id, options);
      if (!result.success) {
        notifyError(result.message ?? "Gagal menghapus pengguna.");
        setPendingDeleteId(null);
        return;
      }
      notifySuccess(result.message ?? "Pengguna dihapus.");
      setPendingDeleteId(null);
      setDialogUser(null);
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
                  initiateDelete(user);
                }}
              >
                {isDeleting && pendingDeleteId === user.id ? "Menghapus..." : "Hapus"}
              </Button>
            </div>
          </div>
        );
      })}
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? "Belum ada pengguna."}
        </p>
      ) : null}
      <UserDeleteDialog
        key={dialogUser ? dialogUser.id : "closed"}
        open={dialogUser !== null}
        user={dialogUser}
        currentUserId={currentUserId}
        availableUsers={availableUsers}
        onClose={closeDialog}
        onConfirm={(options) => {
          if (!dialogUser) return;
          handleConfirmDelete(dialogUser, options);
        }}
        isSubmitting={isDeleting}
      />
    </div>
  );
}
