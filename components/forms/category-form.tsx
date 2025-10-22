"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createCategory } from "./actions";

export function CategoryForm() {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategori Baru</CardTitle>
        <CardDescription>Tambahkan kategori untuk mengorganisasi artikel.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await createCategory(form);
            if (result?.error) {
              setState({ error: result.error });
              return;
            }
            event.currentTarget.reset();
            setState({ success: true });
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" required placeholder="Mis. Budaya" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (opsional)</Label>
            <Input id="slug" name="slug" placeholder="budaya" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Deskripsi singkat" />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Kategori tersimpan.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
