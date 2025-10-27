"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/components/media/media-grid";

const PAGE_SIZE = 12;

type ImageInsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (image: { src: string; alt?: string; width?: string }) => void;
  initialItems?: MediaItem[];
};

type MediaResponse = {
  data: Array<MediaItem & { mimeType: string; createdAt: string }>;
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

const widthOptions = [
  { value: "100%", label: "Lebar penuh" },
  { value: "75%", label: "Lebar 75%" },
  { value: "50%", label: "Lebar 50%" },
  { value: "33%", label: "Lebar 33%" },
  { value: "auto", label: "Ukuran asli" },
] as const;

export function ImageInsertDialog({ open, onOpenChange, onInsert, initialItems = [] }: ImageInsertDialogProps) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [widthPreset, setWidthPreset] = useState<(typeof widthOptions)[number]["value"]>("100%");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  const closeDialog = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const fetchImages = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/dashboard/media?page=${targetPage}&perPage=${PAGE_SIZE}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Gagal memuat media");
        }
        const json = (await response.json()) as MediaResponse;
        const imagesOnly = json.data.filter((item) => item.mimeType.startsWith("image/"));
        setItems(imagesOnly);
        setPage(json.meta.page);
        setTotalPages(Math.max(1, json.meta.totalPages));
        if (imagesOnly.length > 0) {
          setSelectedId(imagesOnly[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat media");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const initialImages = initialItems.filter((item) => item.mimeType.startsWith("image/"));
    setItems(initialImages);
    setSelectedId(initialImages[0]?.id ?? null);
    setWidthPreset("100%");
    setError(null);
    void fetchImages(1);
  }, [open, initialItems, fetchImages]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeDialog]);

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) {
      return;
    }
    await handleUpload(event.target.files);
    event.target.value = "";
  };

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (validFiles.length === 0) {
        setError("Hanya gambar yang dapat diunggah.");
        return;
      }

      setUploading(true);
      setError(null);
      try {
        for (const file of validFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const inferredTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
          formData.append("title", inferredTitle);

          const response = await fetch("/api/dashboard/media", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          const json = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(json.error ?? "Gagal mengunggah gambar");
          }
        }

        await fetchImages(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengunggah gambar");
      } finally {
        setUploading(false);
      }
    },
    [fetchImages]
  );

  const handleInsert = () => {
    if (!selectedItem) {
      setError("Pilih gambar terlebih dahulu.");
      return;
    }
    const width = widthPreset === "auto" ? undefined : widthPreset;
    onInsert({ src: selectedItem.url, alt: selectedItem.title, width });
    closeDialog();
  };

  const handleBackdropClick = () => {
    closeDialog();
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
      <div className="absolute inset-0" onClick={handleBackdropClick} aria-hidden />
      <div className="relative z-10 w-full max-w-5xl max-h-full" role="dialog" aria-modal="true">
        <div className="flex w-full flex-col rounded-xl bg-background shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-h-[calc(100dvh-4rem)] md:overflow-hidden">
          <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Sisipkan Gambar</h2>
              <p className="text-xs text-muted-foreground">
                Pilih atau unggah gambar untuk disisipkan ke konten artikel.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={closeDialog}>
              Tutup
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:divide-x md:divide-border md:overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Mengunggah..." : "Unggah gambar"}
                </Button>
                <Input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadChange}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fetchImages(page)}
                  disabled={loading}
                >
                  Muat ulang
                </Button>
                <span className="text-xs text-muted-foreground">
                  Hanya mendukung file bergambar (JPG, PNG, WEBP, SVG).
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-dashed border-border/60 bg-muted/10">
                {loading ? (
                  <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                    Memuat media...
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    Belum ada gambar. Unggah gambar baru untuk mulai menggunakan.
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto overscroll-contain p-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={cn(
                            "flex flex-col gap-2 rounded-md border border-border bg-background p-2 text-left transition hover:border-primary/60",
                            selectedId === item.id ? "border-primary ring-2 ring-primary/30" : ""
                          )}
                        >
                          <div className="relative h-32 w-full overflow-hidden rounded-md bg-muted/20">
                            <Image
                              src={item.url}
                              alt={item.title}
                              fill
                              className="object-cover"
                              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 80vw"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="line-clamp-1 text-xs font-medium text-foreground">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString("id-ID")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Halaman {page} dari {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || loading}
                      onClick={() => fetchImages(page - 1)}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages || loading}
                      onClick={() => fetchImages(page + 1)}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="flex w-full min-h-0 flex-col justify-between border-t border-border bg-muted/10 px-6 py-5 md:max-w-sm md:border-l md:border-t-0">
              {selectedItem ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Pratinjau</h3>
                    <div className="mt-3 overflow-hidden rounded-md border border-border/60 bg-background">
                      <Image
                        src={selectedItem.url}
                        alt={selectedItem.title}
                        width={320}
                        height={200}
                        className="h-auto w-full object-cover"
                        style={{ width: "100%", height: "auto" }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="text-foreground">
                      <span className="font-medium">Nama:</span> {selectedItem.title}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">URL:</span> {selectedItem.url}
                    </p>
                    <p>
                      <span className="font-medium">Diunggah:</span>{" "}
                      {new Date(selectedItem.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Pilih gambar untuk melihat detail.
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Lebar gambar</p>
                <div className="flex flex-wrap gap-2">
                  {widthOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWidthPreset(option.value)}
                      className={cn(
                        "rounded-md border px-3 py-1 text-[11px] transition",
                        widthPreset === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {error ? <p className="text-xs text-destructive">{error}</p> : null}

              <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  Batal
                </Button>
                <Button type="button" onClick={handleInsert} disabled={!selectedItem}>
                  Sisipkan Gambar
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
