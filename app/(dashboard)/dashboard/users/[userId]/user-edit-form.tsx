"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications/client";

import { deleteUserAction, resetTwoFactorAction, updateUserAction } from "../actions";
import type { DeleteUserOptions } from "../delete-user-types";
import { UserDeleteDialog } from "../user-delete-dialog";

type UserEditFormProps = {
  userId: string;
  initialName: string;
  initialEmail: string;
  initialRole: "ADMIN" | "EDITOR" | "AUTHOR";
  createdAt: string;
  initialEmailVerified: boolean;
  initialCanPublish: boolean;
  initialTwoFactorEnabled: boolean;
  currentUserId: string;
  availableUsers: Array<{ id: string; name: string; email: string }>;
};

export function UserEditForm({
  userId,
  initialName,
  initialEmail,
  initialRole,
  createdAt,
  initialEmailVerified,
  initialCanPublish,
  initialTwoFactorEnabled,
  currentUserId,
  availableUsers,
}: UserEditFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isResetting, startResetting] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "EDITOR" | "AUTHOR">(initialRole);
  const [emailVerified, setEmailVerified] = useState<boolean>(
    initialRole === "AUTHOR" ? initialEmailVerified : true
  );
  const [canPublish, setCanPublish] = useState<boolean>(
    initialRole === "AUTHOR" ? initialCanPublish : true
  );
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(initialTwoFactorEnabled);

  const handleSubmit = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    formData.set("role", selectedRole);
    formData.delete("emailVerified");
    formData.delete("canPublish");
    formData.set("emailVerified", emailVerified ? "true" : "false");
    formData.set("canPublish", canPublish ? "true" : "false");

    startSaving(async () => {
      const result = await updateUserAction(userId, formData);
      if (!result.success) {
        const message = result.message ?? "Gagal memperbarui pengguna.";
        setStatus({ type: "error", message });
        notifyError(message);
        return;
      }

      setStatus({ type: "success", message: "Data pengguna berhasil diperbarui." });
      notifySuccess("Data pengguna berhasil diperbarui.");
      router.refresh();
    });
  };

  const handleResetTwoFactor = () => {
    if (!twoFactorEnabled) {
      notifyInfo("Autentikasi dua faktor sudah nonaktif untuk pengguna ini.");
      return;
    }
    const confirmed = window.confirm(
      "Nonaktifkan autentikator pengguna ini? Pengguna perlu mengatur ulang 2FA saat login berikutnya."
    );
    if (!confirmed) {
      return;
    }

    startResetting(async () => {
      const result = await resetTwoFactorAction(userId);
      if (!result.success) {
        const message = result.message ?? "Gagal menonaktifkan autentikator.";
        notifyError(message);
        setStatus({ type: "error", message });
        return;
      }

      setTwoFactorEnabled(false);
      notifySuccess(result.message ?? "Autentikator telah dinonaktifkan.");
      setStatus({ type: "success", message: result.message ?? "Autentikator dinonaktifkan." });
      router.refresh();
    });
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeletion = (options: DeleteUserOptions) => {
    startDeleting(async () => {
      const result = await deleteUserAction(userId, options);
      if (!result.success) {
        const message = result.message ?? "Gagal menghapus pengguna.";
        notifyError(message);
        setStatus({ type: "error", message });
        return;
      }

      notifySuccess(result.message ?? "Pengguna telah dihapus.");
      router.push("/dashboard/users");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informasi Pengguna</CardTitle>
          <CardDescription>Perbarui nama, email, dan peran pengguna.</CardDescription>
        </CardHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit(event.currentTarget);
          }}
        >
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" name="name" defaultValue={initialName} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={initialEmail} required />
              </div>
              <div className="space-y-2 sm:col-span-2 md:col-span-1">
                <Label htmlFor="role">Peran</Label>
                <select
                  id="role"
                  name="role"
                  value={selectedRole}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(event) => {
                    const nextRole = event.target.value as "ADMIN" | "EDITOR" | "AUTHOR";
                    setSelectedRole(nextRole);
                    if (nextRole !== "AUTHOR") {
                      setEmailVerified(true);
                      setCanPublish(true);
                    }
                  }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="EDITOR">Editor</option>
                  <option value="AUTHOR">Author</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2 md:col-span-1">
                <Label htmlFor="password">Password Baru (opsional)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">Kosongkan jika tidak ingin mengubah password.</p>
              </div>
            </div>
            {selectedRole === "AUTHOR" ? (
              <div className="rounded-md border border-border/60 bg-muted/10 p-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold">Pengaturan Author</p>
                    <p className="text-xs text-muted-foreground">
                      Kontrol status aktivasi dan izin publikasi untuk penulis ini.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border/50 bg-background px-3 py-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Verifikasi Email</p>
                        <p className="text-xs text-muted-foreground">
                          Izinkan penulis masuk dengan status akun aktif.
                        </p>
                      </div>
                      <label
                        htmlFor="emailVerifiedSwitch"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <input
                          id="emailVerifiedSwitch"
                          type="checkbox"
                          checked={emailVerified}
                          onChange={(event) => setEmailVerified(event.target.checked)}
                          className="h-4 w-4 rounded border-border/60 accent-primary"
                        />
                        <span>{emailVerified ? "Aktif" : "Nonaktif"}</span>
                      </label>
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border/50 bg-background px-3 py-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Izin Publikasi</p>
                        <p className="text-xs text-muted-foreground">
                          Tentukan apakah penulis dapat menerbitkan artikel.
                        </p>
                      </div>
                      <label
                        htmlFor="canPublishSwitch"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <input
                          id="canPublishSwitch"
                          type="checkbox"
                          checked={canPublish}
                          onChange={(event) => setCanPublish(event.target.checked)}
                          className="h-4 w-4 rounded border-border/60 accent-primary"
                        />
                        <span>{canPublish ? "Diizinkan" : "Ditahan"}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Dibuat pada {new Date(createdAt).toLocaleString("id-ID")}
            </span>
            <div className="flex items-center gap-2">
              {status ? (
                <p
                  className={`text-sm ${
                    status.type === "success" ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {status.message}
                </p>
              ) : null}
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autentikator Dua Faktor</CardTitle>
          <CardDescription>
            Admin dapat menonaktifkan autentikator pengguna untuk membantu proses recovery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Status Saat Ini</p>
              <p className="text-xs text-muted-foreground">
                {twoFactorEnabled
                  ? "Autentikasi dua faktor aktif. Pengguna wajib memasukkan kode OTP."
                  : "Autentikasi dua faktor tidak aktif untuk pengguna ini."}
              </p>
            </div>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                twoFactorEnabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
              }`}
            >
              {twoFactorEnabled ? "Aktif" : "Nonaktif"}
            </span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleResetTwoFactor}
            disabled={isResetting}
          >
            {isResetting ? "Memproses..." : "Reset Autentikator"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Hapus Pengguna</CardTitle>
          <CardDescription>
            Tentukan terlebih dahulu bagaimana komentar dan artikel pengguna ini akan ditangani sebelum penghapusan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Penghapusan bersifat permanen. Komentar dan artikel dapat dipindahkan ke pengguna lain, akun anonim, atau dihapus.
          </p>
        </CardContent>
        <CardFooter className="flex items-center justify-end">
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={handleDelete}>
            {isDeleting ? "Menghapus..." : "Hapus Pengguna"}
          </Button>
        </CardFooter>
      </Card>

      <UserDeleteDialog
        key={deleteDialogOpen ? userId : "closed"}
        open={deleteDialogOpen}
        user={{ id: userId, name: initialName, email: initialEmail }}
        currentUserId={currentUserId}
        availableUsers={availableUsers}
        isSubmitting={isDeleting}
        onClose={() => {
          if (!isDeleting) {
            setDeleteDialogOpen(false);
          }
        }}
        onConfirm={(options) => {
          setDeleteDialogOpen(false);
          handleConfirmDeletion(options);
        }}
      />
    </div>
  );
}
