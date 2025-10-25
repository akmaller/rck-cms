"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess } from "@/lib/notifications/client";
import { cn } from "@/lib/utils";

type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
};

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

const MAX_FILES = 20;

export function AlbumCreateForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<SelectedFile[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasValidTitle = title.trim().length >= 2;

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
          notifyError(`Maksimal ${MAX_FILES} gambar per album.`);
          break;
        }
        const previewUrl = createPreview(file);
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl,
          description: "",
        });
        existing.set(key, next[next.length - 1]);
      }

      return next;
    });
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && typeof window !== "undefined") {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  };

  const handleSubmit = (status: "DRAFT" | "PUBLISHED") => {
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
      const descriptions = selectedFiles.map((item) => item.description.trim());
      for (const { file } of selectedFiles) {
        formData.append("files", file);
      }
      if (selectedFiles.length > 0) {
        formData.append("fileDescriptions", JSON.stringify(descriptions));
      }

      try {
        const response = await fetch("/api/dashboard/albums", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.error ?? "Gagal menyimpan album.";
          setError(message);
          notifyError(message);
          return;
        }

        notifySuccess(
          status === "PUBLISHED"
            ? "Album berhasil dipublikasikan."
            : "Album disimpan sebagai draft."
        );
        router.push("/dashboard/albums");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan album.";
        setError(message);
        notifyError(message);
      }
    });
  };

  useEffect(() => {
    filesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
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
          onDrop={handleDrop}
          className={cn(
            "relative flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-border/70 bg-muted/30 hover:border-primary/60 hover:bg-primary/5"
          )}
        >
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">
              Tarik & jatuhkan gambar di sini
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
                Kosongkan
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
                Klik tombol silang untuk menghapus gambar. Isikan deskripsi yang akan tampil di
                halaman publik.
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
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
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
                      placeholder="Contoh: Dokumentasi penampilan tari pada acara pembukaan."
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
          Gunakan tombol di kanan untuk menyimpan album sebagai draft atau langsung publish.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit("DRAFT")}
            disabled={isPending || !hasValidTitle}
          >
            {isPending ? "Menyimpan..." : "Simpan sebagai Draft"}
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit("PUBLISHED")}
            disabled={isPending || !hasValidTitle}
          >
            {isPending ? "Memproses..." : "Publikasikan"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
