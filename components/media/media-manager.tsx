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
  type DragEvent,
  type MouseEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications/client";

export type MediaManagerItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  fileName: string;
};

type MediaManagerProps = {
  initialItems: MediaManagerItem[];
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        {children}
      </div>
    </div>,
    document.body
  );
}

export function MediaManager({ initialItems }: MediaManagerProps) {
  const [items, setItems] = useState<MediaManagerItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaManagerItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => {
      const haystack = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [items, search]);

  const openModal = useCallback((item: MediaManagerItem) => {
    setSelectedItem(item);
    setEditTitle(item.title ?? "");
    setEditDescription(item.description ?? "");
    setModalError(null);
  }, []);

  const closeModal = useCallback(() => {
    if (saving || deleting) return;
    setSelectedItem(null);
  }, [saving, deleting]);

  const refreshItem = useCallback((updated: MediaManagerItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedItem(updated);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedItem) return;
    const title = editTitle.trim();
    if (title.length < 2) {
      setModalError("Judul minimal 2 karakter");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const response = await fetch(`/api/dashboard/media/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: (editDescription ?? "").trim() || null,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal menyimpan perubahan");
      }
      const json = await response.json();
      const updated: MediaManagerItem = {
        id: json.data.id,
        title: json.data.title,
        description: json.data.description,
        url: json.data.url,
        thumbnailUrl: json.data.thumbnailUrl ?? selectedItem.thumbnailUrl ?? undefined,
        mimeType: json.data.mimeType,
        size: json.data.size,
        width: json.data.width ?? selectedItem.width ?? null,
        height: json.data.height ?? selectedItem.height ?? null,
        createdAt: new Date(json.data.createdAt).toISOString(),
        fileName: json.data.fileName,
      };
      refreshItem(updated);
      notifySuccess("Perubahan media tersimpan.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan perubahan";
      setModalError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }, [editDescription, editTitle, refreshItem, selectedItem]);

  const handleDelete = useCallback(async () => {
    if (!selectedItem) return;
    if (!confirm("Hapus media ini secara permanen?")) {
      return;
    }
    setDeleting(true);
    setModalError(null);
    try {
      const response = await fetch(`/api/dashboard/media/${selectedItem.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal menghapus media");
      }
      setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setSelectedItem(null);
      notifySuccess("Media dihapus.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus media";
      setModalError(message);
      notifyError(message);
    } finally {
      setDeleting(false);
    }
  }, [selectedItem]);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (fileArray.length === 0) {
        setUploadMessage("Hanya file gambar yang didukung.");
        setUploadProgress(null);
        notifyError("Format file tidak didukung.");
        return;
      }
      const file = fileArray[0];
      setUploadMessage(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/dashboard/media");
      xhr.responseType = "json";
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onerror = () => {
        setUploadMessage("Gagal mengunggah media.");
        setUploadProgress(null);
        notifyError("Gagal mengunggah media.");
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = xhr.response?.data;
          if (data) {
            const newItem: MediaManagerItem = {
              id: data.id,
              title: data.title,
              description: data.description,
              url: data.url,
              thumbnailUrl: data.thumbnailUrl ?? data.url,
              mimeType: data.mimeType,
              size: data.size,
              width: data.width ?? null,
              height: data.height ?? null,
              createdAt: new Date(data.createdAt).toISOString(),
              fileName: data.fileName ?? file.name,
            };
            setItems((prev) => [newItem, ...prev]);
            openModal(newItem);
            notifySuccess("Media berhasil diunggah.");
          }
          setUploadMessage("Unggahan selesai.");
        } else {
          const message = xhr.response?.error ?? "Gagal mengunggah media.";
          setUploadMessage(message);
          notifyError(message);
        }
        setUploadProgress(null);
      };

      xhr.send(formData);
      notifyInfo("Mengunggah media...", "Proses unggah dimulai");
    },
    [openModal]
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      processFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      processFiles(event.target.files);
      event.target.value = "";
    }
  };

  const triggerFileDialog = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
          dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <h3 className="text-lg font-semibold text-foreground">Tarik & lepaskan gambar</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          atau
          <Button variant="link" className="px-1 text-sm" onClick={triggerFileDialog}>
            pilih dari komputer
          </Button>
        </p>
        {uploadProgress !== null ? (
          <div className="mt-4 w-full max-w-sm rounded-full bg-muted/60">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
            <p className="mt-1 text-xs text-muted-foreground">{uploadProgress}%</p>
          </div>
        ) : null}
        {uploadMessage ? <p className="mt-2 text-xs text-muted-foreground">{uploadMessage}</p> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {filteredItems.length} dari {items.length} media
        </p>
        <div className="sm:w-64">
          <Input
            placeholder="Cari berdasarkan judul atau deskripsi..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Tidak ada media yang cocok dengan pencarian Anda.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openModal(item)}
              className="group overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:border-primary/60"
            >
              <div className="relative h-40 w-full overflow-hidden bg-muted">
                {item.mimeType.startsWith("image/") ? (
                  <Image
                    src={item.thumbnailUrl ?? item.url}
                    alt={item.title}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {item.mimeType}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(item.size)} • {formatDate(item.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={Boolean(selectedItem)} onClose={closeModal}>
        {selectedItem ? (
          <div>
            <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 sm:flex-row">
              <div className="relative h-48 w-full overflow-hidden rounded-md bg-muted sm:w-1/2">
                {selectedItem.mimeType.startsWith("image/") ? (
                  <Image
                    src={selectedItem.url}
                    alt={selectedItem.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {selectedItem.mimeType}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="media-title">Judul</Label>
                  <Input
                    id="media-title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-description">Deskripsi</Label>
                  <Textarea
                    id="media-description"
                    rows={4}
                    value={editDescription ?? ""}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="Tambahkan deskripsi atau alt text"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Nama file:</span> {selectedItem.fileName}
              </p>
              <p>
                <span className="font-medium text-foreground">Ukuran:</span> {formatSize(selectedItem.size)}
                {selectedItem.width && selectedItem.height ? (
                  <span> • {selectedItem.width}×{selectedItem.height}px</span>
                ) : null}
              </p>
              <p>
                <span className="font-medium text-foreground">Diunggah pada:</span> {formatDate(selectedItem.createdAt)}
              </p>
            </div>
            {modalError ? <p className="px-4 text-sm text-destructive">{modalError}</p> : null}
            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeModal} disabled={saving || deleting}>
                  Batal
                </Button>
                <Button onClick={handleSave} disabled={saving || deleting}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
