"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createUser } from "./actions";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

export function UserForm() {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Pengguna</CardTitle>
        <CardDescription>Buat akun baru dengan peran Admin, Editor, atau Author.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          startTransition(async () => {
            const result = await createUser(form);
            if (result?.error) {
              setState({ error: result.error });
              notifyError(result.error);
              return;
            }
            formElement.reset();
            setState({ success: true });
            notifySuccess("Pengguna baru berhasil ditambahkan.");
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" required placeholder="Nama lengkap" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" required type="email" placeholder="email@contoh.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password Sementara</Label>
            <Input id="password" name="password" required type="password" placeholder="Minimal 8 karakter" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Peran</Label>
            <select
              id="role"
              name="role"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              <option value="ADMIN">Admin</option>
              <option value="EDITOR">Editor</option>
              <option value="AUTHOR">Author</option>
            </select>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Pengguna berhasil ditambahkan.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
