"use client";

import { useMemo, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { FeaturedImagePicker, type SelectedMedia } from "@/components/media/featured-image-picker";
import type { MediaItem } from "@/components/media/media-grid";
import { slugify } from "@/lib/utils/slug";

import { createArticle, updateArticle } from "./actions";

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
  };
  submitLabel?: string;
  redirectTo?: string;
  allTags: string[];
  allCategories: string[];
};

export function ArticleForm({
  mediaItems,
  initialValues,
  submitLabel = "Simpan Draft",
  redirectTo = "/dashboard/articles",
  allTags,
  allCategories,
}: ArticleFormProps) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string }>({});
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

  const addCategory = (rawValue: string) => {
    const normalized = rawValue.trim().replace(/\s+/g, " ");
    if (!normalized) {
      setCategoryInput("");
      return;
    }
    const lower = normalized.toLowerCase();
    if (selectedCategories.some((category) => category.toLowerCase() === lower)) {
      setCategoryInput("");
      return;
    }
    setSelectedCategories((prev) => [...prev, normalized]);
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

  return (
    <Card>
      <form
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
          startTransition(async () => {
            const submitAction = isEditing ? updateArticle : createArticle;
            if (isEditing && initialValues?.id) {
              formData.set("articleId", initialValues.id);
            }
            const result = await submitAction(formData);
            if (result && "error" in result && result.error) {
              setState({ error: result.error });
              return;
            }
            setState({ error: undefined });
            if (!isEditing) {
              formElement.reset();
              setContent(emptyContent);
              setFeaturedMedia(null);
              setSelectedTags([]);
              setTagInput("");
              setSelectedCategories([]);
              setCategoryInput("");
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
              Pilih satu atau lebih kategori. Kategori pertama akan menjadi kategori utama. Kategori baru akan dibuat otomatis ketika disimpan.
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
