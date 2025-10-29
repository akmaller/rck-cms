"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createPage, updatePage } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { FeaturedImagePicker, type SelectedMedia } from "@/components/media/featured-image-picker";
import type { MediaItem } from "@/components/media/media-grid";
import { useUnsavedChangesPrompt } from "@/components/forms/use-unsaved-changes";
import { extractPlainTextFromContent } from "@/lib/articles/plain-text";
import { findForbiddenMatch, normalizeForComparison } from "@/lib/moderation/filter-utils";
import { notifyError } from "@/lib/notifications/client";


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
  redirectTo?: string;
  publishLabel?: string;
  forbiddenPhrases?: string[];
};

export function PageForm({
  mediaItems,
  initialValues,
  submitLabel = "Simpan Draft",
  publishLabel = "Publikasikan",
  redirectTo = "/dashboard/pages",
  forbiddenPhrases = [],
}: PageFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const pendingRedirectRef = useRef<string>(redirectTo);
  const saveAndExitResolverRef = useRef<((success: boolean) => void) | null>(null);
  const [state, setState] = useState<{ error?: string }>({});
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initialValues?.excerpt ?? "");
  useEffect(() => {
    pendingRedirectRef.current = redirectTo;
  }, [redirectTo]);
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
  const [pendingIntent, setPendingIntent] = useState<"draft" | "publish">("draft");
  const intentRef = useRef<"draft" | "publish">("draft");
  const forbiddenEntries = useMemo(
    () =>
      forbiddenPhrases
        .map((phrase) => ({ phrase, normalized: normalizeForComparison(phrase) }))
        .filter((item) => item.normalized.length > 0),
    [forbiddenPhrases]
  );
  const findForbiddenInValues = useCallback(
    (values: Array<string | null | undefined>) => {
      if (!forbiddenEntries.length) {
        return null;
      }
      for (const value of values) {
        const match = findForbiddenMatch(value, forbiddenEntries);
        if (match) {
          return match.phrase;
        }
      }
      return null;
    },
    [forbiddenEntries]
  );

  const serializePageState = useCallback(
    (params: {
      title: string;
      slug: string;
      excerpt: string;
      content: Record<string, unknown>;
      featuredMediaId: string | null;
    }) =>
      JSON.stringify({
        title: params.title.trim(),
        slug: params.slug.trim(),
        excerpt: params.excerpt.trim(),
        content: JSON.stringify(params.content ?? emptyContent),
        featuredMediaId: params.featuredMediaId,
      }),
    []
  );

  const initialSnapshotRef = useRef(
    serializePageState({
      title: initialValues?.title ?? "",
      slug: initialValues?.slug ?? "",
      excerpt: initialValues?.excerpt ?? "",
      content: initialValues?.content ?? emptyContent,
      featuredMediaId: initialValues?.featuredMediaId ?? null,
    })
  );

  const currentSnapshot = useMemo(
    () =>
      serializePageState({
        title,
        slug,
        excerpt,
        content,
        featuredMediaId: featuredMedia?.id ?? null,
      }),
    [content, excerpt, featuredMedia?.id, serializePageState, slug, title]
  );

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(initialSnapshotRef.current !== currentSnapshot);
  }, [currentSnapshot]);

  const handleSaveAndExit = useCallback(
    async (targetUrl: string | null) => {
      if (!formRef.current) {
        return false;
      }

      pendingRedirectRef.current = targetUrl ?? redirectTo;

      return new Promise<boolean>((resolve) => {
        saveAndExitResolverRef.current = (status) => {
          resolve(status);
        };
        formRef.current?.requestSubmit();
      });
    },
    [redirectTo]
  );

  const { dialog: unsavedChangesDialog } = useUnsavedChangesPrompt({
    isDirty,
    onSaveAndExit: handleSaveAndExit,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Statis</CardTitle>
          <CardDescription>Isi konten halaman dan pilih media unggulan (opsional).</CardDescription>
        </CardHeader>
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const formData = new FormData(formElement);
            formData.set("content", JSON.stringify(content));
            const isEditing = Boolean(initialValues?.id);
            if (featuredMedia?.id) {
              formData.set("featuredMediaId", featuredMedia.id);
            } else if (isEditing) {
              formData.set("featuredMediaId", "__REMOVE__");
            } else {
              formData.delete("featuredMediaId");
            }
            formData.set("intent", intentRef.current);

            const titleValue = formData.get("title");
            const excerptValue = formData.get("excerpt");
            const contentPlainText = extractPlainTextFromContent(content);
            const forbiddenPhrase = findForbiddenInValues([
              typeof titleValue === "string" ? titleValue : null,
              typeof excerptValue === "string" ? excerptValue : null,
              contentPlainText,
            ]);
            if (forbiddenPhrase) {
              const message = `Konten mengandung kata/kalimat terlarang "${forbiddenPhrase}". Hapus kata tersebut sebelum melanjutkan.`;
              setState({ error: message });
              notifyError(message);
              saveAndExitResolverRef.current?.(false);
              saveAndExitResolverRef.current = null;
              pendingRedirectRef.current = redirectTo;
              return;
            }

            startTransition(async () => {
              try {
                const execution = isEditing ? updatePage : createPage;
                const result = await execution(formData);
              if (result && "error" in result && result.error) {
                setState({ error: result.error });
                saveAndExitResolverRef.current?.(false);
                saveAndExitResolverRef.current = null;
                pendingRedirectRef.current = redirectTo;
                return;
              }

              const targetRedirect = pendingRedirectRef.current ?? redirectTo;
              setState({ error: undefined });
              if (!isEditing) {
                formElement.reset();
                setTitle("");
                setSlug("");
                setExcerpt("");
                setContent(emptyContent);
                setFeaturedMedia(null);
                initialSnapshotRef.current = serializePageState({
                  title: "",
                  slug: "",
                  excerpt: "",
                  content: emptyContent,
                  featuredMediaId: null,
                });
              }
              if (isEditing) {
                initialSnapshotRef.current = serializePageState({
                  title,
                  slug,
                  excerpt,
                  content,
                  featuredMediaId: featuredMedia?.id ?? null,
                });
              }
              saveAndExitResolverRef.current?.(true);
              saveAndExitResolverRef.current = null;
              pendingRedirectRef.current = redirectTo;

              intentRef.current = "draft";
              setPendingIntent("draft");
              router.push(targetRedirect);
              router.refresh();
            } catch (error) {
              console.error(error);
              setState({ error: "Gagal menyimpan halaman." });
              saveAndExitResolverRef.current?.(false);
              saveAndExitResolverRef.current = null;
              pendingRedirectRef.current = redirectTo;
            }
          });
        }}
      >
        <CardContent className="space-y-4">
          {initialValues?.id ? <input type="hidden" name="pageId" value={initialValues.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="Judul halaman"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (opsional)</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="tentang-kami"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Ringkasan</Label>
            <Textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              placeholder="Ringkasan pendek"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Konten</Label>
            <TiptapEditor
              value={content}
              onChange={setContent}
              placeholder="Tulis konten halaman..."
              mediaItems={mediaItems}
            />
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
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : (
            <span className="text-xs text-muted-foreground">
              {initialValues?.id
                ? "Simpan perubahan atau publikasikan ulang halaman."
                : "Simpan sebagai draft atau publikasikan halaman baru."}
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                intentRef.current = "draft";
                setPendingIntent("draft");
              }}
            >
              {isPending && pendingIntent === "draft" ? "Menyimpan..." : submitLabel}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              onClick={() => {
                intentRef.current = "publish";
                setPendingIntent("publish");
              }}
            >
              {isPending && pendingIntent === "publish" ? "Memublikasikan..." : publishLabel}
            </Button>
          </div>
        </CardFooter>
        </form>
      </Card>
      {unsavedChangesDialog}
    </>
  );
}
