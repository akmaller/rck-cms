"use client";

import { useRef, useState, useTransition } from "react";

import { uploadMedia } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unggah Media</CardTitle>
        <CardDescription>Terima format gambar atau dokumen kecil, maksimal 5MB.</CardDescription>
      </CardHeader>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const file = form.get("file");
          if (file instanceof File && file.size > MAX_FILE_SIZE_BYTES) {
            setState({ error: "Ukuran file maksimal 5MB" });
            return;
          }
          startTransition(async () => {
            const result = await uploadMedia(form);
            if (result?.error) {
              setState({ error: result.error });
              return;
            }
            formRef.current?.reset();
            setState({ success: true });
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" placeholder="Poster Event" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" required />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Media berhasil diunggah.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Mengunggah..." : "Unggah"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
