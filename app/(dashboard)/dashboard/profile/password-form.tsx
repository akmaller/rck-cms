"use client";

import { useState, useTransition } from "react";

import { changePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

export function PasswordUpdateForm() {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ganti Password</CardTitle>
        <CardDescription>Pastikan password baru kuat dan berbeda dari sebelumnya.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const formData = new FormData(formElement);
          startTransition(async () => {
            const result = await changePassword(formData);
            if (!result.success) {
              setStatus({ type: "error", message: result.message });
              notifyError(result.message);
              return;
            }
            formElement.reset();
            setStatus({ type: "success", message: result.message });
            notifySuccess(result.message);
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Password Saat Ini</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Password Baru</Label>
            <Input id="newPassword" name="newPassword" type="password" minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          {status ? (
            <p
              className={`text-sm ${
                status.type === "success" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {status.message}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">
              Simpan password baru Anda di tempat aman.
            </span>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Memperbarui..." : "Perbarui Password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
