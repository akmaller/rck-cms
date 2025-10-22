"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { MediaPicker } from "@/components/media/media-picker";
import type { MediaItem } from "@/components/media/media-grid";

import { createArticle } from "./actions";

const emptyContent = { type: "doc", content: [] } as const;

type ArticleFormProps = {
  mediaItems: MediaItem[];
  initialValues?: {
    id?: string;
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: Record<string, unknown> | null;
    featuredMediaId?: string | null;
  };
  submitLabel?: string;
  redirectTo?: string;
  onSubmit?: (formData: FormData) => Promise<{ error?: string; success?: boolean } | void>;
};

export function ArticleForm({ mediaItems, initialValues, submitLabel = "Simpan Draft", redirectTo = "/dashboard/articles", onSubmit }: ArticleFormProps) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string }>({});
  const [content, setContent] = useState<Record<string, unknown>>(initialValues?.content ?? emptyContent);
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(initialValues?.featuredMediaId ?? null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artikel Baru</CardTitle>
        <CardDescription>Isi judul, slug (opsional), dan konten singkat.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("content", JSON.stringify(content));
          if (featuredMediaId) {
            formData.set("featuredMediaId", featuredMediaId);
          } else {
            formData.delete("featuredMediaId");
          }
          startTransition(async () => {
            const submitAction = onSubmit ?? createArticle;
            const result = await submitAction(formData);
            if (result && "error" in result && result.error) {
              setState({ error: result.error });
              return;
            }
            router.push(redirectTo);
            router.refresh();
          });
        }}
      >
        <CardContent className="space-y-4">
          {initialValues?.id ? (
            <input type="hidden" name="articleId" value={initialValues.id} />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" required placeholder="Judul artikel" defaultValue={initialValues?.title ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (opsional)</Label>
            <Input id="slug" name="slug" placeholder="slug-khusus" defaultValue={initialValues?.slug ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Ringkasan</Label>
            <Textarea id="excerpt" name="excerpt" rows={4} placeholder="Ringkasan singkat" defaultValue={initialValues?.excerpt ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Konten</Label>
            <TiptapEditor
              value={content}
              onChange={setContent}
              placeholder="Gunakan toolbar untuk menulis konten artikel..."
            />
          </div>
          <div className="space-y-2">
            <Label>Gambar Unggulan</Label>
            {mediaItems.length ? (
              <MediaPicker items={mediaItems} value={featuredMediaId} onSelect={setFeaturedMediaId} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada media. Unggah gambar terlebih dahulu dari halaman Media.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : <span />}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : submitLabel}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
