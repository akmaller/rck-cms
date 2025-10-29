"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { FeaturedImagePicker, type SelectedMedia } from "@/components/media/featured-image-picker";
import type { MediaItem } from "@/components/media/media-grid";
import { ArticleStatus } from "@prisma/client";
import { slugify } from "@/lib/utils/slug";
import { extractPlainTextFromContent } from "@/lib/articles/plain-text";
import { findForbiddenMatch, normalizeForComparison } from "@/lib/moderation/filter-utils";

import { createArticle, updateArticle, deleteArticle } from "./actions";
import { notifyError, notifySuccess } from "@/lib/notifications/client";
import { useUnsavedChangesPrompt } from "@/components/forms/use-unsaved-changes";

const emptyContent = { type: "doc", content: [] } as const;

type ArticleFormProps = {
  mediaItems: MediaItem[];
  initialValues?: {
    id?: string;
    title?: string;
    slug?: string;
    content?: Record<string, unknown> | null;
    featuredMediaId?: string | null;
    tags?: string[];
    categories?: string[];
    status?: ArticleStatus;
    authorId?: string;
  };
  submitLabel?: string;
  draftLabel?: string;
  publishLabel?: string;
  redirectTo?: string;
  allTags: string[];
  allCategories: string[];
  currentRole: "ADMIN" | "EDITOR" | "AUTHOR";
  canPublishContent?: boolean;
  forbiddenPhrases?: string[];
};

export function ArticleForm({
  mediaItems,
  initialValues,
  submitLabel,
  draftLabel = "Simpan Draft",
  publishLabel = "Publikasikan",
  redirectTo = "/dashboard/articles",
  allTags,
  allCategories,
  currentRole,
  canPublishContent = true,
  forbiddenPhrases = [],
}: ArticleFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const pendingRedirectRef = useRef<string>(redirectTo);
  const saveAndExitResolverRef = useRef<((success: boolean) => void) | null>(null);
  const [state, setState] = useState<{ error?: string }>({});
  useEffect(() => {
    pendingRedirectRef.current = redirectTo;
  }, [redirectTo]);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const initialTitle = initialValues?.title ?? "";
  const initialSlug = initialValues?.slug ?? "";
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
  const [isDeleting, startDeleteTransition] = useTransition();
  const forbiddenEntries = useMemo(
    () =>
      forbiddenPhrases
        .map((phrase) => ({
          phrase,
          normalized: normalizeForComparison(phrase),
        }))
        .filter((entry) => entry.normalized.length > 0),
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
  const normalizedAllCategories = useMemo(
    () =>
      Array.from(
        new Set(
          allCategories
            .map((category) => category.trim())
            .filter(Boolean)
        )
      ),
    [allCategories]
  );
  const normalizedAllCategoriesLower = useMemo(
    () => normalizedAllCategories.map((category) => category.toLowerCase()),
    [normalizedAllCategories]
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialValues?.categories ?? []);
  const [categoryInput, setCategoryInput] = useState("");
  const categorySuggestionMouseDownRef = useRef(false);
  const categorySuggestions = useMemo(() => {
    const input = categoryInput.trim().toLowerCase();
    const selectedLower = selectedCategories.map((category) => category.toLowerCase());
    if (input.length === 0) {
      return normalizedAllCategories
        .filter((category) => !selectedLower.includes(category.toLowerCase()))
        .slice(0, 6);
    }
    if (input.length < 2) {
      return [];
    }
    return normalizedAllCategories
      .filter(
        (category) =>
          !selectedLower.includes(category.toLowerCase()) &&
          category.toLowerCase().includes(input)
      )
      .slice(0, 6);
  }, [categoryInput, normalizedAllCategories, selectedCategories]);
  const normalizedAllTags = useMemo(
    () => Array.from(new Set(allTags.map((tag) => tag.trim()).filter(Boolean))),
    [allTags]
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialValues?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const tagSuggestionMouseDownRef = useRef(false);
  const suggestions = useMemo(() => {
    const input = tagInput.trim().toLowerCase();
    if (input.length < 3) {
      return [];
    }
    const selectedLower = selectedTags.map((tag) => tag.toLowerCase());
    return normalizedAllTags
      .filter((tag) => !selectedLower.includes(tag.toLowerCase()) && tag.toLowerCase().includes(input))
      .slice(0, 6);
  }, [normalizedAllTags, selectedTags, tagInput]);

  const canCreateCategories = currentRole !== "AUTHOR";

  const addCategory = (rawValue: string) => {
    const normalized = rawValue.trim().replace(/\s+/g, " ");
    if (!normalized) {
      setCategoryInput("");
      return;
    }
    const lower = normalized.toLowerCase();
    const exists = normalizedAllCategoriesLower.includes(lower);
    if (!canCreateCategories && !exists) {
      setCategoryInput("");
      return;
    }
    if (selectedCategories.some((category) => category.toLowerCase() === lower)) {
      setCategoryInput("");
      return;
    }
    setSelectedCategories((prev) => [...prev, exists ? normalizedAllCategories[normalizedAllCategoriesLower.indexOf(lower)] : normalized]);
    setCategoryInput("");
  };

  const removeCategory = (categoryToRemove: string) => {
    setSelectedCategories((prev) => prev.filter((category) => category !== categoryToRemove));
  };

  const handleCategoryInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCategory(categoryInput);
    } else if (event.key === "Backspace" && !categoryInput && selectedCategories.length > 0) {
      setSelectedCategories((prev) => prev.slice(0, -1));
    }
  };

  const addTag = (rawValue: string) => {
    const normalized = rawValue.trim().replace(/\s+/g, " ");
    if (!normalized) {
      setTagInput("");
      return;
    }
    const lower = normalized.toLowerCase();
    if (selectedTags.some((tag) => tag.toLowerCase() === lower)) {
      setTagInput("");
      return;
    }
    setSelectedTags((prev) => [...prev, normalized]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === "Backspace" && !tagInput && selectedTags.length > 0) {
      setSelectedTags((prev) => prev.slice(0, -1));
    }
  };

  const computedSlug = useMemo(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return initialValues?.id ? initialSlug : "";
    }

    if (initialValues?.id && trimmedTitle === initialTitle.trim() && initialSlug) {
      return initialSlug;
    }

    return slugify(trimmedTitle);
  }, [initialValues?.id, initialSlug, initialTitle, title]);

  const isAuthor = currentRole === "AUTHOR";
  const authorCanPublish = !isAuthor || canPublishContent;
  const isAuthorRestricted = isAuthor && !authorCanPublish;
  const canPublish = currentRole === "ADMIN" || currentRole === "EDITOR" || authorCanPublish;

  type SubmitIntent = "draft" | "publish";
  const defaultIntent: SubmitIntent = isAuthorRestricted
    ? "draft"
    : initialValues?.status === ArticleStatus.PUBLISHED
      ? "publish"
      : "draft";
  const [submitIntent, setSubmitIntent] = useState<SubmitIntent>(defaultIntent);
  const submitIntentRef = useRef<SubmitIntent>(defaultIntent);
  const resolvedSubmitIntent = isAuthorRestricted ? "draft" : submitIntent;

  useEffect(() => {
    submitIntentRef.current = resolvedSubmitIntent;
  }, [resolvedSubmitIntent]);

  const setIntent = useCallback(
    (intent: SubmitIntent) => {
      const nextIntent = isAuthorRestricted ? "draft" : intent;
      setSubmitIntent(nextIntent);
      submitIntentRef.current = nextIntent;
    },
    [isAuthorRestricted]
  );

  const serializeArticleState = useCallback(
    (params: {
      title: string;
      content: Record<string, unknown>;
      featuredMediaId: string | null;
      categories: string[];
      tags: string[];
    }) =>
      JSON.stringify({
        title: params.title.trim(),
        content: JSON.stringify(params.content ?? emptyContent),
        featuredMediaId: params.featuredMediaId,
        categories: params.categories,
        tags: params.tags,
      }),
    []
  );

  const initialSnapshotRef = useRef(
    serializeArticleState({
      title: initialValues?.title ?? "",
      content: initialValues?.content ?? emptyContent,
      featuredMediaId: initialValues?.featuredMediaId ?? null,
      categories: initialValues?.categories ?? [],
      tags: initialValues?.tags ?? [],
    })
  );

  const currentSnapshot = useMemo(
    () =>
      serializeArticleState({
        title,
        content,
        featuredMediaId: featuredMedia?.id ?? null,
        categories: selectedCategories,
        tags: selectedTags,
      }),
    [content, featuredMedia?.id, selectedCategories, selectedTags, serializeArticleState, title]
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

  const handleDelete = () => {
    const articleId = initialValues?.id;
    if (!articleId) {
      return;
    }
    const confirmed = window.confirm("Yakin ingin menghapus artikel ini? Tindakan ini tidak dapat dibatalkan.");
    if (!confirmed) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteArticle(articleId);
      if (result && "error" in result && result.error) {
        setState({ error: result.error });
        notifyError(result.error);
        return;
      }
      setState({ error: undefined });
      notifySuccess("Artikel berhasil dihapus.");
      initialSnapshotRef.current = currentSnapshot;
      router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <>
      <Card>
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const formData = new FormData(formElement);
            if (computedSlug) {
              formData.set("slug", computedSlug);
            } else {
              formData.delete("slug");
            }
            formData.set("content", JSON.stringify(content));
            const isEditing = Boolean(initialValues?.id);
            if (featuredMedia?.id) {
              formData.set("featuredMediaId", featuredMedia.id);
            } else if (isEditing) {
              formData.set("featuredMediaId", "__REMOVE__");
            } else {
              formData.delete("featuredMediaId");
            }
            formData.set("tags", selectedTags.join(","));
            formData.set("categories", selectedCategories.join(","));
            formData.set("intent", submitIntentRef.current);

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
              const submitAction = isEditing ? updateArticle : createArticle;
              if (isEditing && initialValues?.id) {
                formData.set("articleId", initialValues.id);
              }

              const result = await submitAction(formData);
              if (result && "error" in result && result.error) {
                setState({ error: result.error });
                notifyError(result.error);
                saveAndExitResolverRef.current?.(false);
                saveAndExitResolverRef.current = null;
                pendingRedirectRef.current = redirectTo;
                return;
              }

              const targetRedirect = pendingRedirectRef.current ?? redirectTo;
              const snapshotAfterSave = serializeArticleState({
                title,
                content,
                featuredMediaId: featuredMedia?.id ?? null,
                categories: selectedCategories,
                tags: selectedTags,
              });

              setState({ error: undefined });
              if (!isEditing) {
                formElement.reset();
                setTitle("");
                setContent(emptyContent);
                setFeaturedMedia(null);
                setSelectedTags([]);
                setTagInput("");
                setSelectedCategories([]);
                setCategoryInput("");
                setIntent("draft");
                initialSnapshotRef.current = serializeArticleState({
                  title: "",
                  content: emptyContent,
                  featuredMediaId: null,
                  categories: [],
                  tags: [],
                });
                notifySuccess("Artikel baru berhasil disimpan.");
              } else {
                notifySuccess("Perubahan artikel tersimpan.");
                initialSnapshotRef.current = snapshotAfterSave;
              }

              saveAndExitResolverRef.current?.(true);
              saveAndExitResolverRef.current = null;
              pendingRedirectRef.current = redirectTo;

              router.push(targetRedirect);
              router.refresh();
            } catch (error) {
              console.error(error);
              setState({ error: "Gagal menyimpan artikel." });
              notifyError("Gagal menyimpan artikel.");
              saveAndExitResolverRef.current?.(false);
              saveAndExitResolverRef.current = null;
              pendingRedirectRef.current = redirectTo;
            }
          });
        }}
      >
        <CardContent className="space-y-4">
          {initialValues?.id ? (
            <input type="hidden" name="articleId" value={initialValues.id} />
          ) : null}
          {isAuthorRestricted ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Akun penulis Anda menunggu persetujuan admin. Anda masih bisa menyimpan draft, tetapi belum dapat memublikasikan artikel.
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="Judul artikel"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              value={computedSlug}
              readOnly
              className="bg-muted"
              placeholder="slug otomatis akan muncul di sini"
            />
            <p className="text-xs text-muted-foreground">Slug dibentuk otomatis dari judul.</p>
          </div>
          <div className="space-y-2">
            <Label>Konten</Label>
            <TiptapEditor
              value={content}
              onChange={setContent}
              placeholder="Gunakan toolbar untuk menulis konten artikel..."
              mediaItems={mediaItems}
            />
          </div>
          <div className="space-y-2">
            <Label>Gambar Unggulan</Label>
            <FeaturedImagePicker
              initialItems={mediaItems}
              selected={featuredMedia}
              onSelect={setFeaturedMedia}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categories-input">Kategori</Label>
              <div className="rounded-md border border-border/60 bg-background p-2">
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map((category, index) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    <span className="flex items-center gap-2">
                      {category}
                      {index === 0 ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          Primary
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="text-primary hover:text-primary/70"
                      onClick={() => removeCategory(category)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  id="categories-input"
                  value={categoryInput}
                  onChange={(event) => setCategoryInput(event.target.value)}
                  onKeyDown={handleCategoryInputKeyDown}
                  onBlur={() => {
                    if (categorySuggestionMouseDownRef.current) {
                      categorySuggestionMouseDownRef.current = false;
                      return;
                    }
                    addCategory(categoryInput);
                  }}
                  placeholder={selectedCategories.length === 0 ? "Tambah kategori..." : ""}
                  className="min-w-[140px] flex-1 bg-transparent text-xs text-foreground focus:outline-none"
                />
              </div>
              {categorySuggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {categorySuggestions.map((category) => (
                    <button
                      type="button"
                      key={category}
                      onMouseDown={() => {
                        categorySuggestionMouseDownRef.current = true;
                      }}
                      onClick={() => {
                        addCategory(category);
                        categorySuggestionMouseDownRef.current = false;
                      }}
                      className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
              <p className="text-xs text-muted-foreground">
                {canCreateCategories
                  ? "Pilih satu atau lebih kategori. Kategori pertama menjadi kategori utama. Ketik nama baru untuk membuat kategori baru."
                  : "Pilih kategori yang tersedia. Jika tidak menemukan kategori yang cocok, hubungi Editor atau Admin."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags-input">Tag</Label>
              <div className="rounded-md border border-border/60 bg-background p-2">
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      className="text-primary hover:text-primary/70"
                      onClick={() => removeTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  id="tags-input"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={() => {
                    if (tagSuggestionMouseDownRef.current) {
                      tagSuggestionMouseDownRef.current = false;
                      return;
                    }
                    addTag(tagInput);
                  }}
                  placeholder={selectedTags.length === 0 ? "Tambah tag..." : ""}
                  className="min-w-[120px] flex-1 bg-transparent text-xs text-foreground focus:outline-none"
                />
              </div>
              {suggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onMouseDown={() => {
                        tagSuggestionMouseDownRef.current = true;
                      }}
                      onClick={() => {
                        addTag(tag);
                        tagSuggestionMouseDownRef.current = false;
                      }}
                      className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Pisahkan tag dengan Enter atau koma. Tag baru akan dibuat otomatis ketika disimpan.
            </p>
          </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {initialValues?.id ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending || isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "Menghapus..." : "Hapus Artikel"}
              </Button>
            ) : null}
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={isPending || isDeleting}
              onClick={() => setIntent("draft")}
            >
              {isPending && resolvedSubmitIntent === "draft"
                ? "Menyimpan..."
                : submitLabel ?? draftLabel}
            </Button>
            {canPublish ? (
              <Button
                type="submit"
                variant="secondary"
                disabled={isPending || isDeleting}
                onClick={() => setIntent("publish")}
              >
                {isPending && resolvedSubmitIntent === "publish"
                  ? "Memublikasikan..."
                  : publishLabel}
              </Button>
            ) : null}
          </div>
        </CardFooter>
        </form>
      </Card>
      {unsavedChangesDialog}
    </>
  );
}
