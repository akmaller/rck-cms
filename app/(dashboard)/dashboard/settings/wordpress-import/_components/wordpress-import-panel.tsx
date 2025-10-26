"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import {
  fetchWordpressCategoriesAction,
  fetchWordpressPostsAction,
  importWordpressPostAction,
} from "../actions";
import type { WordpressCategory, WordpressPostPayload } from "@/lib/wordpress/importer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type LoadState = "idle" | "loading";

type AuthorOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  AUTHOR: "Penulis",
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function WordpressImportPanel({
  authors,
  defaultAuthorId,
}: {
  authors: AuthorOption[];
  defaultAuthorId: string;
}) {
  const [siteUrl, setSiteUrl] = useState("");
  const [categories, setCategories] = useState<WordpressCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [posts, setPosts] = useState<WordpressPostPayload[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [intent, setIntent] = useState<"publish" | "draft">("draft");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryLoadState, setCategoryLoadState] = useState<LoadState>("idle");
  const [postLoadState, setPostLoadState] = useState<LoadState>("idle");
  const [importState, setImportState] = useState<LoadState>("idle");
  const [selectedAuthorId, setSelectedAuthorId] = useState(() => {
    if (authors.length === 0) {
      return "";
    }
    const hasDefault = authors.some((author) => author.id === defaultAuthorId);
    return hasDefault ? defaultAuthorId : authors[0].id;
  });
  const authorDisplayMap = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        name: string;
      }
    >();
    authors.forEach((author) => {
      const roleLabel = ROLE_LABEL[author.role] ?? author.role;
      const base = author.name?.trim() || author.email?.trim() || "Tanpa nama";
      map.set(author.id, {
        label: roleLabel ? `${base} (${roleLabel})` : base,
        name: base,
      });
    });
    return map;
  }, [authors]);
  const selectedAuthorDisplay = selectedAuthorId ? authorDisplayMap.get(selectedAuthorId) : undefined;

  const currentPost = posts[currentPostIndex];

  const progress = useMemo(() => {
    if (!totalItems || totalItems <= 0) {
      return 0;
    }
    const ratio = processedCount / totalItems;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, [processedCount, totalItems]);

  const handleFetchCategories = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setCategories([]);
    setSelectedCategoryId("");
    setPosts([]);
    setTotalItems(0);
    setTotalPages(0);
    setProcessedCount(0);
    setImportedCount(0);
    setSkippedCount(0);

    if (!siteUrl.trim()) {
      setErrorMessage("Masukkan URL situs WordPress terlebih dahulu.");
      return;
    }

    setCategoryLoadState("loading");
    const result = await fetchWordpressCategoriesAction(siteUrl);
    setCategoryLoadState("idle");

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setCategories(result.categories);
    if (result.categories.length === 0) {
      setStatusMessage("Tidak ditemukan kategori pada situs WordPress tersebut.");
    } else {
      setStatusMessage(`Berhasil memuat ${result.categories.length} kategori WordPress.`);
    }
  };

  const resetProgress = () => {
    setPosts([]);
    setCurrentPostIndex(0);
    setCurrentPage(1);
    setTotalPages(0);
    setTotalItems(0);
    setProcessedCount(0);
    setImportedCount(0);
    setSkippedCount(0);
    setStatusMessage(null);
  };

  const fetchPosts = async (page: number, resetCounters: boolean) => {
    if (!siteUrl.trim()) {
      setErrorMessage("URL WordPress belum diisi.");
      return;
    }
    const categoryIdNumeric = Number(selectedCategoryId);
    if (!categoryIdNumeric) {
      setErrorMessage("Pilih kategori WordPress terlebih dahulu.");
      return;
    }

    if (resetCounters) {
      resetProgress();
    }

    setErrorMessage(null);
    setPostLoadState("loading");

    const result = await fetchWordpressPostsAction({
      siteUrl,
      categoryId: categoryIdNumeric,
      page,
    });

    setPostLoadState("idle");

    if (!result.success) {
      setErrorMessage(result.message);
      if (resetCounters) {
        resetProgress();
      }
      return;
    }

    const { posts: fetchedPosts, page: nextPage, totalPages: totalPageCount, totalItems: totalItemsCount, skippedDuplicates } =
      result.data;

    setPosts(fetchedPosts);
    setCurrentPostIndex(0);
    setCurrentPage(nextPage);
    setTotalPages(totalPageCount);
    setTotalItems(totalItemsCount);

    if (resetCounters) {
      setImportedCount(0);
      setProcessedCount(skippedDuplicates);
      setSkippedCount(skippedDuplicates);
    } else if (skippedDuplicates > 0) {
      setProcessedCount((prev) => prev + skippedDuplicates);
      setSkippedCount((prev) => prev + skippedDuplicates);
    }

    let status: string;
    if (fetchedPosts.length === 0) {
      status =
        skippedDuplicates > 0
          ? "Semua postingan pada halaman ini telah diimpor sebelumnya dan dilewati otomatis."
          : "Tidak ada postingan untuk kategori tersebut.";
    } else {
      status = `Memuat ${fetchedPosts.length} dari ${totalItemsCount} postingan (halaman ${nextPage} dari ${Math.max(
        1,
        totalPageCount
      )}).`;
      if (skippedDuplicates > 0) {
        status += ` ${skippedDuplicates} postingan duplikat dilewati otomatis.`;
      }
    }
    setStatusMessage(status);

    if (fetchedPosts.length === 0 && totalPageCount > 0 && nextPage < totalPageCount) {
      await fetchPosts(nextPage + 1, false);
    }
  };

  const handleLoadPosts = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetchPosts(1, true);
  };

  const loadNextPost = async () => {
    if (currentPostIndex + 1 < posts.length) {
      setCurrentPostIndex((prev) => prev + 1);
      return;
    }

    if (totalPages > 0 && currentPage < totalPages) {
      await fetchPosts(currentPage + 1, false);
      return;
    }

    setPosts([]);
    setStatusMessage("Semua postingan pada kategori ini telah diproses.");
  };

  const handleSkip = async () => {
    if (!currentPost) return;
    setSkippedCount((prev) => prev + 1);
    setProcessedCount((prev) => prev + 1);
    setStatusMessage(`Postingan "${currentPost.title}" dilewati secara manual.`);
    await loadNextPost();
  };

  const handleImport = async () => {
    if (!currentPost) {
      return;
    }

    if (!selectedAuthorId) {
      setErrorMessage("Pilih penulis artikel sebelum melakukan impor.");
      return;
    }

    setImportState("loading");
    setErrorMessage(null);

    const result = await importWordpressPostAction({
      siteUrl,
      post: currentPost,
      intent,
      authorId: selectedAuthorId,
    });

    setImportState("idle");

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    if (result.data.skipped) {
      setSkippedCount((prev) => prev + 1);
      setProcessedCount((prev) => prev + 1);
      setStatusMessage(`Postingan "${currentPost.title}" telah diimpor sebelumnya dan dilewati otomatis.`);
      await loadNextPost();
      return;
    }

    setImportedCount((prev) => prev + 1);
    setProcessedCount((prev) => prev + 1);
    const assignedInfo = selectedAuthorDisplay?.label ?? "penulis terpilih";
    setStatusMessage(
      `Artikel "${currentPost.title}" berhasil diimpor sebagai ${intent === "publish" ? "publikasi" : "draft"} dan ditugaskan ke ${assignedInfo}.`
    );
    await loadNextPost();
  };

  const disableControls = categoryLoadState === "loading" || postLoadState === "loading" || importState === "loading";

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleFetchCategories}>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="wordpress-url">URL Situs WordPress</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="wordpress-url"
              placeholder="https://contoh.com"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              disabled={disableControls}
            />
            <Button type="submit" disabled={categoryLoadState === "loading"}>
              {categoryLoadState === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memuat...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Ambil Kategori
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Masukkan URL WordPress (dengan atau tanpa skema). Sistem akan mengambil daftar kategori yang tersedia.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="wordpress-author">Penulis Artikel</Label>
          {authors.length > 0 ? (
            <>
              <select
                id="wordpress-author"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedAuthorId}
                onChange={(event) => setSelectedAuthorId(event.target.value)}
                disabled={disableControls}
              >
                {authors.map((author) => {
                  const display = authorDisplayMap.get(author.id)?.label ?? author.id;
                  return (
                    <option key={author.id} value={author.id}>
                      {display}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-muted-foreground">
                Artikel yang diimpor akan langsung ditugaskan ke penulis yang dipilih.
              </p>
            </>
          ) : (
            <p className="text-xs text-destructive">
              Tidak ada penulis yang tersedia. Tambahkan pengguna dengan peran penulis terlebih dahulu.
            </p>
          )}
        </div>
      </form>

      {categories.length > 0 ? (
        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleLoadPosts}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="wordpress-category">Kategori WordPress</Label>
            <select
              id="wordpress-category"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              disabled={disableControls}
            >
              <option value="">Pilih kategori...</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name} ({category.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto" disabled={!selectedCategoryId || postLoadState === "loading"}>
              {postLoadState === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memuat...
                </>
              ) : (
                "Muat Postingan"
              )}
            </Button>
          </div>
        </form>
      ) : null}

      {totalItems > 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-border/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Diproses {processedCount} dari {totalItems} postingan • Diimpor {importedCount} • Dilewati {skippedCount}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status artikel baru:</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs font-medium text-foreground">
                  <input
                    type="radio"
                    name="import-intent"
                    value="draft"
                    checked={intent === "draft"}
                    onChange={() => setIntent("draft")}
                    disabled={disableControls}
                  />
                  Draft
                </label>
                <label className="flex items-center gap-1 text-xs font-medium text-foreground">
                  <input
                    type="radio"
                    name="import-intent"
                    value="publish"
                    checked={intent === "publish"}
                    onChange={() => setIntent("publish")}
                    disabled={disableControls}
                  />
                  Publikasi
                </label>
              </div>
            </div>
          </div>

          <div className="w-full rounded-full bg-muted/40">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-right text-xs text-muted-foreground">{progress}% selesai</p>

          {currentPost ? (
            <div className="space-y-4 rounded-md border border-border/80 bg-background/60 p-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Judul</p>
                <h3 className="text-lg font-semibold text-foreground">{currentPost.title}</h3>
                <p className="text-xs text-muted-foreground">Dipublikasikan: {formatDate(currentPost.date)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Kategori</p>
                <div className="flex flex-wrap gap-2">
                  {currentPost.categories.length > 0 ? (
                    currentPost.categories.map((category) => (
                      <Badge key={category.id} variant="secondary">
                        {category.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Tidak ada kategori</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Tag</p>
                <div className="flex flex-wrap gap-2">
                  {currentPost.tags.length > 0 ? (
                    currentPost.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        #{tag.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Tidak ada tag</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Ringkasan</p>
                <p className="text-sm text-foreground">
                  {currentPost.excerptText ? currentPost.excerptText : "Ringkasan tidak tersedia dari WordPress."}
                </p>
              </div>

              {currentPost.featuredMedia ? (
                <p className="text-xs text-muted-foreground">
                  Gambar unggulan akan diunduh dari:{" "}
                  <span className="break-all text-foreground">{currentPost.featuredMedia.sourceUrl}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Postingan ini tidak memiliki gambar unggulan.</p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={handleImport}
                  disabled={importState === "loading" || disableControls}
                >
                  {importState === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengimpor...
                    </>
                  ) : (
                    "Import sebagai artikel baru"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={handleSkip}
                  disabled={disableControls}
                >
                  Lewati
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
