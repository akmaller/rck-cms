"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createTag } from "./actions";

export function TagForm() {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag Baru</CardTitle>
        <CardDescription>Tambahkan tag untuk mempermudah pencarian konten.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await createTag(form);
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
            <Input id="name" name="name" required placeholder="Mis. Event" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (opsional)</Label>
            <Input id="slug" name="slug" placeholder="event" />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Tag tersimpan.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
