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
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notifications/client";

import { deleteUserAction, updateUserAction } from "../actions";

type UserEditFormProps = {
  userId: string;
  initialName: string;
  initialEmail: string;
  initialRole: "ADMIN" | "EDITOR" | "AUTHOR";
  createdAt: string;
};

export function UserEditForm({
  userId,
  initialName,
  initialEmail,
  initialRole,
  createdAt,
}: UserEditFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (form: HTMLFormElement) => {
    const formData = new FormData(form);
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

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      notifyWarning("Klik hapus sekali lagi untuk konfirmasi.");
      return;
    }

    startDeleting(async () => {
      const result = await deleteUserAction(userId);
      if (!result.success) {
        const message = result.message ?? "Gagal menghapus pengguna.";
        notifyError(message);
        setStatus({ type: "error", message });
        setConfirmDelete(false);
        return;
      }

      notifySuccess("Pengguna telah dihapus.");
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
                  defaultValue={initialRole}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Hapus Pengguna</CardTitle>
          <CardDescription>
            Tindakan ini akan menghapus akun dan memindahkan artikel ke akun Anda. Harap berhati-hati.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Setelah dihapus, pengguna tidak dapat dikembalikan kecuali ditambahkan kembali secara manual.
          </p>
          {confirmDelete ? (
            <p className="text-sm font-medium text-destructive">
              Klik &ldquo;Hapus Sekarang&rdquo; untuk konfirmasi. Artikel akan dialihkan ke akun Anda.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => {
              setConfirmDelete(false);
              setStatus(null);
            }}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? "Menghapus..." : confirmDelete ? "Hapus Sekarang" : "Hapus Pengguna"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
