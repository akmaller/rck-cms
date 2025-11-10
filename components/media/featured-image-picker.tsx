"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { MediaItem } from "./media-grid";

const ITEMS_PER_PAGE = 10;

function formatMediaDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return "-";
  }
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function describeMediaError(error: MediaError): string {
  let label: string;
  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      label = "MEDIA_ERR_ABORTED";
      break;
    case MediaError.MEDIA_ERR_NETWORK:
      label = "MEDIA_ERR_NETWORK";
      break;
    case MediaError.MEDIA_ERR_DECODE:
      label = "MEDIA_ERR_DECODE";
      break;
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      label = "MEDIA_ERR_SRC_NOT_SUPPORTED";
      break;
    default:
      label = "MEDIA_ERR_UNKNOWN";
      break;
  }
  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? `: ${error.message.trim()}`
      : "";
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.error(`[MediaPreview] ${label} (code ${error.code})${message}`, error);
  }
  return `${label} (code ${error.code})${message}`;
}

export type SelectedMedia = {
  id: string;
  title: string;
  url: string;
  description?: string | null;
  mimeType: string;
  createdAt: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
};

type FeaturedImagePickerProps = {
  initialItems?: MediaItem[];
  selected?: SelectedMedia | null;
  onSelect: (media: SelectedMedia | null) => void;
  label?: string;
};

type MediaResponse = {
  data: Array<
    MediaItem & {
      mimeType: string;
      createdAt: string;
      description?: string | null;
      thumbnailUrl?: string | null;
      duration?: number | null;
    }
  >;
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

export function FeaturedImagePicker({
  initialItems = [],
  selected,
  onSelect,
  label = "Pilih Media Unggulan",
}: FeaturedImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(selected ?? null);
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(selected?.description ?? "");
  const [savingDescription, setSavingDescription] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewErrorInfo, setPreviewErrorInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedMedia(selected ?? null);
    setDescriptionDraft(selected?.description ?? "");
    setPreviewError(false);
    setPreviewErrorInfo(null);
  }, [selected]);

  const fetchPage = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setListError(null);
      try {
        const res = await fetch(
          `/api/dashboard/media?page=${targetPage}&perPage=${ITEMS_PER_PAGE}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          throw new Error("Gagal memuat media");
        }
        const data = (await res.json()) as MediaResponse;
        setItems(
          data.data.map((item) => ({
            ...item,
            createdAt: item.createdAt,
            thumbnailUrl: item.thumbnailUrl ?? item.url,
          }))
        );
        setPage(data.meta.page);
        setTotalPages(Math.max(1, data.meta.totalPages));
      } catch (error) {
        setListError(error instanceof Error ? error.message : "Gagal memuat media");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void fetchPage(1);
  }, [isOpen, fetchPage]);

  const handleOpen = () => {
    setIsOpen(true);
    setUploadError(null);
    setUploadProgress(null);
    setSaveSuccess(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsDragging(false);
    setUploadError(null);
    setUploadProgress(null);
    setSaveSuccess(false);
  };

  const handleUseSelected = () => {
    if (!selectedMedia) {
      onSelect(null);
      handleClose();
      return;
    }
    onSelect(selectedMedia);
    handleClose();
  };

  const handleClearSelection = () => {
    setSelectedMedia(null);
    setDescriptionDraft("");
    onSelect(null);
  };

  const currentSelection = useMemo(() => {
    if (!selectedMedia) return null;
    return selectedMedia;
  }, [selectedMedia]);

  const handleSelectionChange = (item: MediaItem) => {
    const selectedItem: SelectedMedia = {
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description ?? null,
      mimeType: item.mimeType,
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : item.createdAt.toISOString(),
      thumbnailUrl: item.thumbnailUrl ?? item.url,
      duration: item.duration ?? null,
    };
    setSelectedMedia(selectedItem);
    setDescriptionDraft(selectedItem.description ?? "");
    setSaveSuccess(false);
    setPreviewError(false);
    setPreviewErrorInfo(null);
  };

  const handleFilesUpload = useCallback(
    (files: FileList | File[]) => {
      setUploadError(null);
      const candidates = Array.from(files);
      if (candidates.length === 0) {
        return;
      }

      const file = candidates[0];
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setUploadError("Hanya format gambar atau video yang dapat diunggah sebagai media unggulan.");
        return;
      }

      const limit = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > limit) {
        setUploadError(isVideo ? "Ukuran video maksimal 50MB." : "Ukuran gambar maksimal 5MB.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      const inferredTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim();
      if (inferredTitle) {
        formData.append("title", inferredTitle);
      }

      setUploading(true);
      setUploadProgress(0);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/dashboard/media");
      xhr.responseType = "json";
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      const handleFailure = (message: string) => {
        setUploadError(message);
        setUploading(false);
        setUploadProgress(null);
      };

      xhr.onerror = () => {
        handleFailure("Gagal mengunggah media.");
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = xhr.response as
            | { data?: Record<string, unknown>; error?: string }
            | undefined;
          const data = response?.data as
            | (SelectedMedia & {
                createdAt?: string;
                thumbnailUrl?: string | null;
                description?: string | null;
                duration?: number | null;
              })
            | undefined;
          if (data) {
            const normalized: SelectedMedia = {
              id: data.id,
              title: data.title,
              description: data.description ?? null,
              url: data.url,
              mimeType: data.mimeType,
              createdAt: data.createdAt ?? new Date().toISOString(),
              thumbnailUrl: data.thumbnailUrl ?? data.url,
              duration: data.duration ?? null,
            };
            setSelectedMedia(normalized);
            setDescriptionDraft(normalized.description ?? "");
            setSaveSuccess(false);
          }
          setUploadError(null);
          void fetchPage(1);
        } else {
          const response = xhr.response as { error?: string } | undefined;
          handleFailure(response?.error ?? "Gagal mengunggah media.");
          return;
        }
        setUploading(false);
        setUploadProgress(null);
        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }, 0);
      };

      xhr.send(formData);
    },
    [fetchPage]
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const { files } = event.dataTransfer;
    if (files && files.length > 0) {
      void handleFilesUpload(files);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDescriptionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nativeEvent = event.nativeEvent;
    if (typeof nativeEvent.stopImmediatePropagation === "function") {
      nativeEvent.stopImmediatePropagation();
    }
    if (!selectedMedia) return;
    setSavingDescription(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/dashboard/media/${selectedMedia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descriptionDraft }),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Gagal menyimpan deskripsi");
      }
      const updated = json.data as SelectedMedia;
      setSelectedMedia(updated);
      setSaveSuccess(true);
      setItems((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, description: updated.description, title: updated.title } : item
        )
      );
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gagal menyimpan deskripsi");
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={handleOpen}>
          {label}
        </Button>
        {currentSelection ? (
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-2">
            {currentSelection.mimeType.startsWith("video/") ? (
              <div className="relative h-12 w-12 overflow-hidden rounded border border-border/60 bg-black/80">
                {currentSelection.thumbnailUrl ? (
                  <Image
                    src={currentSelection.thumbnailUrl}
                    alt={currentSelection.title}
                    fill
                    className="object-cover opacity-80"
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white" />
                </div>
              </div>
            ) : (
              <Image
                src={currentSelection.thumbnailUrl ?? currentSelection.url}
                alt={currentSelection.title}
                width={48}
                height={48}
                className="h-12 w-12 rounded object-cover"
              />
            )}
            <div className="text-xs">
              <p className="font-medium text-foreground">{currentSelection.title}</p>
              <p className="text-muted-foreground">{currentSelection.description ?? "Tanpa deskripsi"}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleClearSelection}>
              Hapus
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Belum ada media unggulan.</span>
        )}
      </div>

      {isOpen ? (
        <Modal onClose={handleClose}>
          <div className="flex w-full max-w-5xl flex-col rounded-xl bg-background shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-h-[calc(100dvh-4rem)] md:overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Media Library</h2>
                <p className="text-xs text-muted-foreground">
                  Pilih media unggulan atau unggah gambar (maks. 5MB) maupun video (maks. 50MB).
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={handleClose}>
                Tutup
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:divide-x md:divide-border md:overflow-hidden">
              <div className="flex-1 min-h-0">
                <div className="flex h-full min-h-0 flex-col">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`mx-6 mt-4 flex min-h-[160px] flex-col items-center justify-center rounded border-2 border-dashed px-6 py-8 text-center text-sm transition ${
                      isDragging ? "border-primary bg-primary/10" : "border-border/60"
                    }`}
                  >
                    <p className="font-medium text-foreground">Tarik & Letakkan media (gambar atau video) di sini</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Gambar maksimal 5MB · Video maksimal 50MB
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      atau
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3"
                      onClick={handleUploadClick}
                      disabled={uploading}
                    >
                      {uploading
                        ? `Mengunggah${typeof uploadProgress === "number" ? ` ${uploadProgress}%` : "..." }`
                        : "Unggah dari komputer"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => {
                        const { files } = event.target;
                        if (files && files.length > 0) {
                          handleFilesUpload(files);
                        }
                      }}
                    />
                    {typeof uploadProgress === "number" ? (
                      <div className="mt-4 w-full max-w-xs">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Mengunggah {uploadProgress}%
                        </p>
                      </div>
                    ) : null}
                    {uploadError ? <p className="mt-3 text-xs text-destructive">{uploadError}</p> : null}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4">
                    {loading ? (
                      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        Memuat...
                      </div>
                    ) : listError ? (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-destructive">
                        <p>{listError}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => fetchPage(page)}>
                          Coba lagi
                        </Button>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        Belum ada media yang diunggah.
                      </div>
                    ) : (
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => handleSelectionChange(item)}
                            className={`flex flex-col overflow-hidden rounded-md border text-left transition hover:border-primary/60 ${
                              selectedMedia?.id === item.id ? "border-primary ring-2 ring-primary/40" : "border-border/60"
                            }`}
                          >
                            {item.mimeType.startsWith("image/") ? (
                              <Image
                                src={item.thumbnailUrl ?? item.url}
                                alt={item.title}
                                width={320}
                                height={200}
                                className="h-40 w-full object-cover"
                              />
                            ) : item.mimeType.startsWith("video/") ? (
                              <div className="relative h-40 w-full overflow-hidden bg-black/80">
                                {item.thumbnailUrl ? (
                                  <Image
                                    src={item.thumbnailUrl}
                                    alt={item.title}
                                    fill
                                    className="object-cover opacity-80"
                                  />
                                ) : null}
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-white">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70">
                                    <Play className="h-5 w-5" />
                                  </div>
                                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide">
                                    Video
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-40 w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground">
                                {item.mimeType}
                              </div>
                            )}
                            <div className="space-y-1 px-3 py-2">
                              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {item.description ?? "Tidak ada deskripsi"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(item.createdAt as string).toLocaleString("id-ID")}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
                    <span>
                      Halaman {page} dari {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => fetchPage(page - 1)}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages || loading}
                        onClick={() => fetchPage(page + 1)}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex w-full min-h-0 flex-col justify-between border-t border-border bg-muted/10 md:max-w-sm md:border-t-0 md:border-l">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4">
                  {selectedMedia ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Pratinjau</h3>
                        {selectedMedia.mimeType.startsWith("video/") ? (
                          <div className="mt-3 overflow-hidden rounded-md border border-border/60 bg-black">
                            <video
                              key={selectedMedia.id}
                              className="h-auto w-full bg-black object-contain"
                              controls
                              preload="metadata"
                              playsInline
                              controlsList="nodownload"
                              poster={selectedMedia.thumbnailUrl ?? undefined}
                              onPlay={() => {
                                setPreviewError(false);
                                setPreviewErrorInfo(null);
                              }}
                              onError={(event) => {
                                setPreviewError(true);
                                const mediaError = event.currentTarget.error;
                                if (mediaError) {
                                  setPreviewErrorInfo(describeMediaError(mediaError));
                                } else {
                                  setPreviewErrorInfo("MEDIA_ERR_UNKNOWN");
                                }
                              }}
                            >
                              <source
                                src={selectedMedia.url}
                                type={
                                  selectedMedia.mimeType.startsWith("video/") ||
                                  selectedMedia.mimeType.startsWith("audio/")
                                    ? selectedMedia.mimeType
                                    : undefined
                                }
                              />
                              <source src={selectedMedia.url} />
                              Browser Anda tidak mendukung tag video.
                            </video>
                            {previewError ? (
                              <div className="px-3 py-2 text-xs text-destructive">
                                Pratinjau video gagal dimuat. Silakan pastikan format videonya didukung.
                                {previewErrorInfo ? (
                                  <span className="ml-1 font-semibold uppercase tracking-wide">
                                    {previewErrorInfo}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <Image
                            src={selectedMedia.thumbnailUrl ?? selectedMedia.url}
                            alt={selectedMedia.title}
                            width={360}
                            height={240}
                            className="mt-3 w-full rounded-md object-cover"
                          />
                        )}
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p><span className="font-medium text-foreground">Nama:</span> {selectedMedia.title}</p>
                        <p>
                          <span className="font-medium text-foreground">URL:</span>{" "}
                          <span className="break-all">{selectedMedia.url}</span>
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Diunggah:</span>{" "}
                          {new Date(selectedMedia.createdAt).toLocaleString("id-ID")}
                        </p>
                        {selectedMedia.mimeType.startsWith("video/") && selectedMedia.duration ? (
                          <p>
                            <span className="font-medium text-foreground">Durasi:</span>{" "}
                            {formatMediaDuration(selectedMedia.duration)}
                          </p>
                        ) : null}
                      </div>
                      <form className="space-y-3" onSubmit={handleDescriptionSubmit}>
                        <label className="text-xs font-medium text-foreground" htmlFor="media-description">
                          Deskripsi / Alt text
                        </label>
                        <Textarea
                          id="media-description"
                          value={descriptionDraft}
                          rows={4}
                          placeholder="Tuliskan deskripsi gambar untuk aksesibilitas."
                          onChange={(event) => {
                            setDescriptionDraft(event.target.value);
                            setSaveSuccess(false);
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Button type="submit" size="sm" disabled={savingDescription}>
                            {savingDescription ? "Menyimpan..." : "Simpan Deskripsi"}
                          </Button>
                          {saveSuccess ? <span className="text-xs text-emerald-600">Tersimpan</span> : null}
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                      Pilih salah satu gambar untuk melihat detail dan menambahkan deskripsi.
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                  >
                    Batal
                  </Button>
                  <Button type="button" onClick={handleUseSelected} disabled={!selectedMedia}>
                    Gunakan gambar ini
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
};

function Modal({ children, onClose }: ModalProps) {
  const [mounted] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-6xl max-h-full" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body
  );
}
