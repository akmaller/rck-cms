"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ArticleStatus } from "@prisma/client";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { notifyError, notifySuccess } from "@/lib/notifications/client";
import { cn } from "@/lib/utils";

type ExistingAlbumImage = {
  id: string;
  mediaId: string;
  url: string;
  title: string | null;
  size: number;
  caption: string;
};

type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
};

type AlbumEditFormProps = {
  album: {
    id: string;
    title: string;
    description: string | null;
    status: ArticleStatus;
    images: ExistingAlbumImage[];
  };
};

const MAX_FILES = 20;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function createPreview(file: File) {
  if (typeof window === "undefined") return "";
  return URL.createObjectURL(file);
}

function deriveThumbnail(url: string | null): string | null {
  if (!url) return null;
  const [pathPart, rest] = url.split(/(?=[?#])/);
  const segments = pathPart.split("/");
  const fileName = segments.pop();
  if (!fileName) return null;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const ext = fileName.slice(dotIndex).toLowerCase();
  if (ext !== ".webp") {
    return null;
  }
  const base = fileName.slice(0, dotIndex);
  const thumbName = `${base}-thumb${ext}`;
  const newPath = [...segments, thumbName].join("/");
  return rest ? `${newPath}${rest}` : newPath;
}

const STATUS_OPTIONS: Array<{ value: ArticleStatus; label: string }> = [
  { value: ArticleStatus.DRAFT, label: "Draft" },
  { value: ArticleStatus.REVIEW, label: "Review" },
  { value: ArticleStatus.SCHEDULED, label: "Terjadwal" },
  { value: ArticleStatus.PUBLISHED, label: "Publik" },
  { value: ArticleStatus.ARCHIVED, label: "Arsip" },
];

export function AlbumEditForm({ album }: AlbumEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedImages = useMemo<ExistingAlbumImage[]>(
    () =>
      album.images.map((image) => ({
        id: image.id,
        mediaId: image.mediaId,
        url: image.url,
        title: image.title,
        size: image.size,
        caption: image.caption ?? "",
      })),
    [album.images]
  );
  const initialImagesRef = useRef<ExistingAlbumImage[]>(normalizedImages);
  const [title, setTitle] = useState(album.title);
  const [description, setDescription] = useState(album.description ?? "");
  const [status, setStatus] = useState<ArticleStatus>(album.status);
  const [existingImages, setExistingImages] = useState<ExistingAlbumImage[]>(normalizedImages);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const filesRef = useRef<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasValidTitle = title.trim().length >= 2;

  useEffect(() => {
    filesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const incomingFiles = Array.from(files);
    if (incomingFiles.length === 0) {
      return;
    }

    setSelectedFiles((prev) => {
      const existing = new Map(prev.map((item) => [item.file.name + item.file.size, item]));
      const next: SelectedFile[] = [...prev];

      for (const file of incomingFiles) {
        if (!file.type.startsWith("image/")) {
          notifyError(`File ${file.name} bukan gambar yang valid.`);
          continue;
        }
        const key = file.name + file.size;
        if (existing.has(key)) {
          continue;
        }
        if (next.length >= MAX_FILES) {
          notifyError(`Maksimal ${MAX_FILES} gambar per unggahan.`);
          break;
        }
        const previewUrl = createPreview(file);
        const item = {
          id: crypto.randomUUID(),
          file,
          previewUrl,
          description: "",
        };
        next.push(item);
        existing.set(key, item);
      }

      return next;
    });
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && typeof window !== "undefined") {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const moveExistingImage = (index: number, direction: "up" | "down") => {
    setExistingImages((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const removeExistingImage = (id: string) => {
    setExistingImages((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = () => {
    if (!hasValidTitle) {
      setError("Judul album minimal 2 karakter.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("status", status);
      if (description.trim().length > 0) {
        formData.append("description", description.trim());
      }

      const currentIds = new Set(existingImages.map((item) => item.id));
      const removedIds = initialImagesRef.current
        .map((item) => item.id)
        .filter((id) => !currentIds.has(id));
      formData.append(
        "imageOrder",
        JSON.stringify(existingImages.map((item) => item.id))
      );
      if (removedIds.length > 0) {
        formData.append("removedImageIds", JSON.stringify(removedIds));
      }
      if (existingImages.length > 0) {
        const captionPayload: Record<string, string> = {};
        existingImages.forEach((item) => {
          captionPayload[item.id] = item.caption.trim();
        });
        formData.append("imageCaptions", JSON.stringify(captionPayload));
      }

      const fileDescriptions = selectedFiles.map((item) => item.description.trim());
      for (const { file } of selectedFiles) {
        formData.append("files", file);
      }
      if (selectedFiles.length > 0) {
        formData.append("fileDescriptions", JSON.stringify(fileDescriptions));
      }

      try {
        const response = await fetch(`/api/dashboard/albums/${album.id}`, {
          method: "PATCH",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.error ?? "Gagal memperbarui album.";
          setError(message);
          notifyError(message);
          return;
        }

        notifySuccess("Album berhasil diperbarui.");
        router.push("/dashboard/albums");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan saat memperbarui album.";
        setError(message);
        notifyError(message);
      }
    });
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="album-title">Judul Album</Label>
            <Input
              id="album-title"
              placeholder="Contoh: Dokumentasi Festival Seni"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <ToggleGroup
              type="single"
              value={status}
              onValueChange={(value) => {
                if (!value) return;
                setStatus(value as ArticleStatus);
              }}
              className="flex w-full flex-wrap gap-2"
            >
              {STATUS_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="flex-1 text-xs sm:flex-none sm:text-sm">
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="album-description">Deskripsi</Label>
            <Textarea
              id="album-description"
              placeholder="Tulis deskripsi singkat mengenai album ini."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Gambar dalam Album</h3>
            <p className="text-xs text-muted-foreground">
              Susun ulang atau hapus gambar sesuai kebutuhan.
            </p>
          </div>
          {existingImages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Album belum memiliki gambar. Tambahkan gambar baru di bawah ini.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {existingImages.map((item, index) => {
                const previewUrl = deriveThumbnail(item.url) ?? item.url;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
                  >
                    <div className="relative h-40 w-full overflow-hidden border-b border-border/60 bg-muted">
                      <Image
                        src={previewUrl}
                        alt={item.title ?? `Gambar ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      />
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                        {formatBytes(item.size)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 p-3 text-xs text-muted-foreground">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">
                            {item.title ?? `Gambar ${index + 1}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveExistingImage(index, "up")}
                            disabled={index === 0 || isPending}
                            aria-label="Pindahkan ke atas"
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveExistingImage(index, "down")}
                            disabled={index === existingImages.length - 1 || isPending}
                            aria-label="Pindahkan ke bawah"
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeExistingImage(item.id)}
                            disabled={isPending}
                            aria-label="Hapus gambar dari album"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor={`${item.id}-caption`}
                          className="text-xs font-semibold text-foreground"
                        >
                          Deskripsi Publik
                        </Label>
                        <Textarea
                          id={`${item.id}-caption`}
                          value={item.caption}
                          onChange={(event) =>
                            setExistingImages((prev) =>
                              prev.map((entry) =>
                                entry.id === item.id ? { ...entry, caption: event.target.value } : entry
                              )
                            )
                          }
                          placeholder="Tulis deskripsi yang akan tampil di halaman publik."
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(false);
            addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "relative flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-border/70 bg-muted/30 hover:border-primary/60 hover:bg-primary/5"
          )}
        >
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">
              Tarik & jatuhkan gambar baru
            </p>
            <p className="text-sm text-muted-foreground">
              Unggah hingga {MAX_FILES} gambar sekaligus. Format JPG, PNG, atau WebP.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              Pilih Gambar
            </Button>
            {selectedFiles.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setSelectedFiles((prev) => {
                    if (typeof window !== "undefined") {
                      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                    }
                    return [];
                  })
                }
                disabled={isPending}
              >
                Kosongkan Pilihan
              </Button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            id="album-files"
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) {
                addFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </div>

        {selectedFiles.length > 0 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {selectedFiles.length} gambar baru dipilih
              </h3>
              <p className="text-xs text-muted-foreground">
                Isi deskripsi untuk setiap gambar. Deskripsi akan tampil di halaman publik.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {selectedFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 shadow-sm"
                >
                  <div className="relative h-40 w-full overflow-hidden rounded-md border border-border/60">
                    <Image
                      src={item.previewUrl}
                      alt={item.file.name}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 40vw, (min-width: 768px) 45vw, 100vw"
                    />
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(item.id)}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow transition hover:bg-destructive"
                      aria-label={`Hapus ${item.file.name}`}
                    >
                      ×
                    </button>
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      {formatBytes(item.file.size)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {item.file.name}
                    </p>
                    <Label htmlFor={`${item.id}-description`} className="text-xs font-semibold">
                      Deskripsi Gambar
                    </Label>
                    <Textarea
                      id={`${item.id}-description`}
                      value={item.description}
                      onChange={(event) =>
                        setSelectedFiles((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, description: event.target.value }
                              : entry
                          )
                        )
                      }
                      placeholder="Contoh: Prosesi penyerahan penghargaan oleh panitia."
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Setelah menyimpan, perubahan akan langsung diterapkan pada album.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/albums")}
            disabled={isPending}
          >
            Batalkan
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || !hasValidTitle}>
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
