"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createPage } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { FeaturedImagePicker, type SelectedMedia } from "@/components/media/featured-image-picker";
import type { MediaItem } from "@/components/media/media-grid";


const emptyContent = { type: "doc", content: [] } as const;

type PageFormProps = {
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
  onSubmit?: (formData: FormData) => Promise<{ error?: string } | void>;
  redirectTo?: string;
};

export function PageForm({
  mediaItems,
  initialValues,
  submitLabel = "Simpan Draft",
  onSubmit,
  redirectTo = "/dashboard/pages",
}: PageFormProps) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string }>({});
  const [content, setContent] = useState<Record<string, unknown>>(initialValues?.content ?? emptyContent);
  const initialFeatured = initialValues?.featuredMediaId
    ? mediaItems.find((item) => item.id === initialValues.featuredMediaId)
    : undefined;
  const [featuredMedia, setFeaturedMedia] = useState<SelectedMedia | null>(
    initialFeatured
      ? {
          id: initialFeatured.id,
          title: initialFeatured.title,
          description: initialFeatured.description ?? null,
          url: initialFeatured.url,
          mimeType: initialFeatured.mimeType,
          createdAt:
            typeof initialFeatured.createdAt === "string"
              ? initialFeatured.createdAt
              : initialFeatured.createdAt.toISOString(),
        }
      : null
  );
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Halaman Statis</CardTitle>
        <CardDescription>Isi konten halaman dan pilih media unggulan (opsional).</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("content", JSON.stringify(content));
          const isEditing = Boolean(initialValues?.id);
          if (featuredMedia?.id) {
            formData.set("featuredMediaId", featuredMedia.id);
          } else if (isEditing) {
            formData.set("featuredMediaId", "__REMOVE__");
          } else {
            formData.delete("featuredMediaId");
          }

          startTransition(async () => {
            const result = await (onSubmit ? onSubmit(formData) : createPage(formData));
            if (result && "error" in result && result.error) {
              setState({ error: result.error });
              return;
            }
            setState({ error: undefined });
            if (!onSubmit) {
              event.currentTarget.reset();
              setContent(emptyContent);
              setFeaturedMedia(null);
            }
            router.push(redirectTo);
            router.refresh();
          });
        }}
      >
        <CardContent className="space-y-4">
          {initialValues?.id ? <input type="hidden" name="pageId" value={initialValues.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" required placeholder="Judul halaman" defaultValue={initialValues?.title ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (opsional)</Label>
            <Input id="slug" name="slug" placeholder="tentang-kami" defaultValue={initialValues?.slug ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Ringkasan</Label>
            <Textarea id="excerpt" name="excerpt" rows={3} placeholder="Ringkasan pendek" defaultValue={initialValues?.excerpt ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Konten</Label>
            <TiptapEditor value={content} onChange={setContent} placeholder="Tulis konten halaman..." />
          </div>
          <div className="space-y-2">
            <Label>Media Unggulan</Label>
            <FeaturedImagePicker
              initialItems={mediaItems}
              selected={featuredMedia}
              onSelect={setFeaturedMedia}
              label="Pilih Media Unggulan"
            />
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
