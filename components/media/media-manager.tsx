"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications/client";
import { getCroppedImage } from "@/lib/media/crop-image";
import { Play } from "lucide-react";

type MediaUploader = {
  id: string;
  name: string | null;
  email: string | null;
};

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
  duration?: number | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  createdAt: string;
  fileName: string;
  createdBy: MediaUploader | null;
};

type MediaManagerMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  filters: {
    uploadedBy: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
};

export type MediaManagerProps = {
  initialItems: MediaManagerItem[];
  initialMeta: MediaManagerMeta;
  initialSearch?: string;
  uploaderOptions: MediaUploader[];
  currentUserId: string;
  canViewAllUsers: boolean;
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

type AppliedQuery = {
  page: number;
  search: string;
  uploadedBy: string;
  dateFrom: string;
  dateTo: string;
  refreshToken: number;
};

type FilterDraft = {
  search: string;
  uploadedBy: string;
  dateFrom: string;
  dateTo: string;
};

type MediaApiResponseItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  createdAt: string | Date;
  fileName?: string | null;
  createdBy?:
    | {
        id: string;
        name: string | null;
        email: string | null;
      }
    | null;
};

type MediaListResponse = {
  data: MediaApiResponseItem[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    filters?: {
      uploadedBy?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
    };
  };
};

type CropContext =
  | { type: "upload" }
  | { type: "existing"; item: MediaManagerItem };

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

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remaining = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function mapResponseItem(data: MediaApiResponseItem): MediaManagerItem {
  return {
    id: data.id,
    title: data.title ?? "Tanpa judul",
    description: data.description ?? null,
    url: data.url,
    thumbnailUrl: data.thumbnailUrl ?? data.url,
    mimeType: data.mimeType ?? "image/webp",
    size: data.size ?? 0,
    width: data.width ?? null,
    height: data.height ?? null,
    duration: data.duration ?? null,
    thumbnailWidth: data.thumbnailWidth ?? null,
    thumbnailHeight: data.thumbnailHeight ?? null,
    createdAt: new Date(data.createdAt).toISOString(),
    fileName: data.fileName ?? data.title ?? "media",
    createdBy: data.createdBy
      ? {
          id: data.createdBy.id,
          name: data.createdBy.name ?? null,
          email: data.createdBy.email ?? null,
        }
      : null,
  };
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-6 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="max-h-[90vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function MediaManager({
  initialItems,
  initialMeta,
  initialSearch = "",
  uploaderOptions,
  currentUserId,
  canViewAllUsers,
}: MediaManagerProps) {
  const perPage = initialMeta.perPage;
  const initialUploadedBy = canViewAllUsers
    ? initialMeta.filters.uploadedBy ?? "me"
    : "me";
  const initialDateFrom = initialMeta.filters.dateFrom ?? "";
  const initialDateTo = initialMeta.filters.dateTo ?? "";

  const [items, setItems] = useState<MediaManagerItem[]>(initialItems);
  const [meta, setMeta] = useState<MediaManagerMeta>(initialMeta);
  const [query, setQuery] = useState<AppliedQuery>({
    page: initialMeta.page,
    search: initialSearch,
    uploadedBy: initialUploadedBy,
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    refreshToken: 0,
  });
  const [draft, setDraft] = useState<FilterDraft>({
    search: initialSearch,
    uploadedBy: initialUploadedBy,
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaManagerItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [croppingFile, setCroppingFile] = useState<File | null>(null);
  const [croppingPreview, setCroppingPreview] = useState<string | null>(null);
  const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null);
  const [cropAreaPercent, setCropAreaPercent] = useState<Area | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [processingCrop, setProcessingCrop] = useState(false);
  const [cropContext, setCropContext] = useState<CropContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const firstLoadRef = useRef(true);

  const resetCropperState = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setCropperOpen(false);
    setCroppingFile(null);
    setCroppingPreview(null);
    setCropAreaPixels(null);
    setCropAreaPercent(null);
    setCropAreaPercent(null);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setProcessingCrop(false);
    setCropContext(null);
  }, []);

  const handleCropComplete = useCallback((croppedArea: Area, croppedPixels: Area) => {
    setCropAreaPercent(croppedArea);
    setCropAreaPixels(croppedPixels);
  }, []);

  type FileKind = "image" | "video";

  const validateFile = useCallback((file: File): { valid: boolean; type: FileKind | null; message?: string } => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return { valid: false, type: null, message: "Hanya file gambar atau video yang didukung." };
    }
    const limit = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > limit) {
      return {
        valid: false,
        type: isImage ? "image" : "video",
        message: isVideo ? "Ukuran video maksimal 50MB." : "Ukuran gambar maksimal 5MB.",
      };
    }
    return { valid: true, type: isImage ? "image" : "video" };
  }, []);

  const reportUploadError = useCallback((message: string) => {
    setUploadMessage(message);
    setUploadProgress(null);
    notifyError(message);
  }, []);

  const uploaderChoices = useMemo(() => {
    const dedup = new Set<string>();
    const options: Array<{ value: string; label: string }> = [
      { value: "me", label: "Media saya" },
    ];
    if (canViewAllUsers) {
      options.push({ value: "all", label: "Semua pengguna" });
      uploaderOptions.forEach((user) => {
        if (!user?.id || dedup.has(user.id)) {
          return;
        }
        dedup.add(user.id);
        const labelSource = user.name ?? user.email ?? "Pengguna tanpa nama";
        options.push({
          value: user.id,
          label: user.id === currentUserId ? `${labelSource} (Anda)` : labelSource,
        });
      });
    }
    return options;
  }, [uploaderOptions, currentUserId, canViewAllUsers]);

  const {
    page,
    search,
    uploadedBy,
    dateFrom,
    dateTo,
    refreshToken,
  } = query;

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (uploadedBy && (canViewAllUsers || uploadedBy === "me")) {
      params.set("uploadedBy", uploadedBy);
    }
    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }
    if (dateTo) {
      params.set("dateTo", dateTo);
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/dashboard/media?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Gagal memuat data media.");
        }
        return response.json() as Promise<MediaListResponse>;
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        const responseTotalPages = json.meta?.totalPages ?? 0;
        if (responseTotalPages > 0 && page > responseTotalPages) {
          setQuery((prev) => ({
            ...prev,
            page: responseTotalPages,
          }));
          return;
        }
        const mapped = (json.data ?? []).map((item) => mapResponseItem(item));
        setItems(mapped);
        setMeta({
          page: json.meta?.page ?? page,
          perPage: json.meta?.perPage ?? perPage,
          total: json.meta?.total ?? mapped.length,
          totalPages: json.meta?.totalPages ?? 1,
          filters: {
            uploadedBy: canViewAllUsers
              ? json.meta?.filters?.uploadedBy ?? uploadedBy
              : "me",
            dateFrom: json.meta?.filters?.dateFrom ?? null,
            dateTo: json.meta?.filters?.dateTo ?? null,
          },
        });
        setSelectedItem((prev) => (prev ? mapped.find((item) => item.id === prev.id) ?? prev : null));
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Terjadi kesalahan saat memuat media.";
        setError(message);
        notifyError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, perPage, search, uploadedBy, dateFrom, dateTo, refreshToken, canViewAllUsers]);

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
  }, []);
  const handleCopyUrl = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        notifySuccess("Link media berhasil disalin.");
      } catch (error) {
        console.error("Failed to copy media url", error);
        notifyError("Gagal menyalin link media.");
      }
    },
    []
  );

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
      const json: { data: MediaApiResponseItem } = await response.json();
      const updated = mapResponseItem(json.data);
      refreshItem(updated);
      notifySuccess("Perubahan media tersimpan.");
      setSelectedItem(null);
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
      setMeta((prev) => ({
        ...prev,
        total: Math.max(prev.total - 1, 0),
      }));
      setSelectedItem(null);
      setQuery((prev) => ({
        ...prev,
        refreshToken: prev.refreshToken + 1,
      }));
      notifySuccess("Media dihapus.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus media";
      setModalError(message);
      notifyError(message);
    } finally {
      setDeleting(false);
    }
  }, [selectedItem]);

  const uploadFile = useCallback(
    (file: File) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        if (validation.message) {
          reportUploadError(validation.message);
        }
        return;
      }

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
        reportUploadError("Gagal mengunggah media.");
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = xhr.response?.data as MediaApiResponseItem | undefined;
          if (data) {
            const newItem = mapResponseItem(data);
            setItems((prev) => [newItem, ...prev]);
            setMeta((prev) => ({
              ...prev,
              total: prev.total + 1,
            }));
            openModal(newItem);
            setQuery((prev) => ({
              ...prev,
              page: 1,
              refreshToken: prev.refreshToken + 1,
            }));
            notifySuccess("Media berhasil diunggah.");
          }
          setUploadMessage("Unggahan selesai.");
        } else {
          const message = xhr.response?.error ?? "Gagal mengunggah media.";
          reportUploadError(message);
        }
        setUploadProgress(null);
      };

      xhr.send(formData);
      notifyInfo("Mengunggah media...", "Proses unggah dimulai");
    },
    [openModal, reportUploadError, validateFile]
  );

  const replaceMediaFile = useCallback(
    async (mediaId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/dashboard/media/${mediaId}`, {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });

      let json: { data?: MediaApiResponseItem; error?: string } | null = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok || !json?.data) {
        const message = json?.error ?? "Gagal mengganti gambar media.";
        throw new Error(message);
      }

      const updated = mapResponseItem(json.data);
      refreshItem(updated);
      setSelectedItem((prev) => (prev?.id === updated.id ? updated : prev));
      setModalError(null);
      setUploadMessage(null);
      setUploadProgress(null);
      notifySuccess("Gambar media berhasil diperbarui.");
    },
    [refreshItem]
  );

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return;
      }
      const file = fileArray[0];
      const validation = validateFile(file);
      if (!validation.valid) {
        if (validation.message) {
          reportUploadError(validation.message);
        }
        return;
      }

      if (validation.type === "image") {
        const reader = new FileReader();
        reader.onload = () => {
          if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
            previewObjectUrlRef.current = null;
          }
        setCroppingFile(file);
        setCroppingPreview(reader.result as string);
        setCropAreaPixels(null);
        setCropAreaPercent(null);
        setCropPosition({ x: 0, y: 0 });
        setCropZoom(1);
        setProcessingCrop(false);
        setCropContext({ type: "upload" });
        setUploadMessage("Sesuaikan area crop sebelum mengunggah.");
          setUploadProgress(null);
          setCropperOpen(true);
        };
        reader.onerror = () => {
          reportUploadError("Gagal membaca file gambar untuk crop.");
        };
        reader.readAsDataURL(file);
        return;
      }

      uploadFile(file);
    },
    [reportUploadError, uploadFile, validateFile]
  );

  const handleCloseCropper = useCallback(() => {
    if (processingCrop) {
      return;
    }
    resetCropperState();
  }, [processingCrop, resetCropperState]);

  const handleConfirmCrop = useCallback(async () => {
    if (!croppingFile || !croppingPreview) {
      reportUploadError("Tidak ada file gambar yang dipilih.");
      return;
    }
    if (!cropAreaPixels) {
      reportUploadError("Pilih area crop terlebih dahulu.");
      return;
    }
    setProcessingCrop(true);
    try {
      const croppedFile = await getCroppedImage({
        imageSrc: croppingPreview,
        cropArea: cropAreaPixels,
        cropPercent: cropAreaPercent ?? undefined,
        fileName: croppingFile.name,
        mimeType: croppingFile.type,
      });

      if (cropContext?.type === "existing") {
        await replaceMediaFile(cropContext.item.id, croppedFile);
        resetCropperState();
      } else {
        resetCropperState();
        uploadFile(croppedFile);
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Gagal memproses hasil crop. Coba ulangi.";
      reportUploadError(message);
      setProcessingCrop(false);
    }
  }, [
    cropAreaPercent,
    cropAreaPixels,
    cropContext,
    croppingFile,
    croppingPreview,
    replaceMediaFile,
    reportUploadError,
    resetCropperState,
    uploadFile,
  ]);

  const handleSkipCrop = useCallback(() => {
    if (!croppingFile) {
      resetCropperState();
      return;
    }
    const context = cropContext;
    const originalFile = croppingFile;
    resetCropperState();
    if (context?.type === "upload") {
      uploadFile(originalFile);
    }
  }, [croppingFile, cropContext, resetCropperState, uploadFile]);

  const handleStartExistingCrop = useCallback(async () => {
    if (!selectedItem || !selectedItem.mimeType.startsWith("image/")) {
      notifyError("Media ini tidak mendukung crop.");
      return;
    }
    try {
      setProcessingCrop(true);
      let blob: Blob | null = null;
      const response = await fetch(selectedItem.url, { credentials: "omit" }).catch(() => null);
      if (response?.ok) {
        blob = await response.blob();
      }
      if (!blob && selectedItem.thumbnailUrl) {
        const thumbResponse = await fetch(selectedItem.thumbnailUrl, { credentials: "omit" }).catch(() => null);
        if (thumbResponse?.ok) {
          blob = await thumbResponse.blob();
        }
      }
      if (!blob) {
        throw new Error("Gagal mengambil gambar.");
      }
      if (!blob.type.startsWith("image/")) {
        throw new Error("File bukan gambar.");
      }
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      const baseFromSlug =
        selectedItem.title.trim().length > 0
          ? selectedItem.title.trim().toLowerCase().replace(/\s+/g, "-")
          : "media";
      const extension = blob.type.split("/")[1] ?? "png";
      const fileName = selectedItem.fileName
        ? (selectedItem.fileName.split("/").pop() ?? `${baseFromSlug}.${extension}`)
        : `${baseFromSlug}.${extension}`;
      const file = new File([blob], fileName, { type: blob.type || "image/png" });
      const objectUrl = URL.createObjectURL(blob);
      previewObjectUrlRef.current = objectUrl;
      setCroppingFile(file);
      setCroppingPreview(objectUrl);
      setCropAreaPixels(null);
      setCropAreaPercent(null);
      setCropPosition({ x: 0, y: 0 });
      setCropZoom(1);
      setCropContext({ type: "existing", item: selectedItem });
      setUploadMessage(null);
      setUploadProgress(null);
      setProcessingCrop(false);
      setCropperOpen(true);
    } catch (error) {
      console.error(error);
      reportUploadError("Gagal memuat gambar untuk crop.");
      setProcessingCrop(false);
    }
  }, [reportUploadError, selectedItem]);

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

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUploadedBy = canViewAllUsers ? draft.uploadedBy : "me";
    setQuery((prev) => ({
      ...prev,
      page: 1,
      search: draft.search.trim(),
      uploadedBy: nextUploadedBy,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
    }));
  };

  const handleResetFilters = () => {
    const defaults: FilterDraft = {
      search: "",
      uploadedBy: canViewAllUsers ? "me" : "me",
      dateFrom: "",
      dateTo: "",
    };
    setDraft(defaults);
    setQuery((prev) => ({
      ...prev,
      page: 1,
      search: "",
      uploadedBy: "me",
      dateFrom: "",
      dateTo: "",
    }));
  };

  const handlePageChange = (nextPage: number) => {
    const totalPages = meta.totalPages > 0 ? meta.totalPages : 1;
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }
    setQuery((prev) => ({
      ...prev,
      page: nextPage,
    }));
  };

  const totalPagesDisplay = meta.totalPages > 0 ? meta.totalPages : 1;
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="space-y-6">
      <Modal open={cropperOpen} onClose={handleCloseCropper}>
        {cropperOpen && croppingPreview ? (
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-xl">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h3 className="text-lg font-semibold text-foreground">Crop Gambar</h3>
              <p className="text-xs text-muted-foreground">
                Sesuaikan area yang ingin diunggah, lalu simpan perubahan.
              </p>
            </div>
            <div className="space-y-4 px-4 pb-4 pt-4">
              <div className="relative h-80 w-full overflow-hidden rounded-lg bg-black/80">
                <Cropper
                  image={croppingPreview}
                  crop={cropPosition}
                  zoom={cropZoom}
                  onCropChange={setCropPosition}
                  onZoomChange={setCropZoom}
                  onCropComplete={handleCropComplete}
                  aspect={16 / 9}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex w-full flex-col gap-1 text-xs font-medium text-muted-foreground sm:w-auto sm:flex-1">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={cropZoom}
                    onChange={(event) => setCropZoom(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none overflow-hidden rounded-full bg-muted"
                    aria-label="Zoom crop"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCloseCropper} disabled={processingCrop}>
                    Batal
                  </Button>
                  {cropContext?.type === "upload" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSkipCrop}
                      disabled={processingCrop}
                    >
                      Unggah tanpa Crop
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" onClick={handleConfirmCrop} disabled={processingCrop}>
                    {processingCrop ? "Memproses..." : "Simpan Crop"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
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
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <h3 className="text-lg font-semibold text-foreground">Tarik & lepaskan media (gambar atau video)</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Gambar maksimal 5MB · Video maksimal 50MB, atau
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

      <form className="space-y-4" onSubmit={handleApplyFilters}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              <span>Sedang memuat media...</span>
            ) : (
              <span>
                Menampilkan {items.length} media (halaman {meta.page} dari {totalPagesDisplay}) dari total{" "}
                {meta.total} media.
              </span>
            )}
          </div>
          <div className="sm:w-64">
            <Input
              placeholder="Cari berdasarkan judul atau deskripsi..."
              value={draft.search}
              onChange={(event) => setDraft((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="uploadedBy">Diunggah oleh</Label>
            <select
              id="uploadedBy"
              value={draft.uploadedBy}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  uploadedBy: event.target.value,
                }))
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={!canViewAllUsers}
            >
              {uploaderChoices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateFrom">Tanggal awal</Label>
            <Input
              id="dateFrom"
              type="date"
              value={draft.dateFrom}
              onChange={(event) => setDraft((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">Tanggal akhir</Label>
            <Input
              id="dateTo"
              type="date"
              value={draft.dateTo}
              onChange={(event) => setDraft((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:place-self-end">
            <Label className="sr-only" htmlFor="apply-filters">
              Aksi filter
            </Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleResetFilters} disabled={isLoading}>
                Atur ulang
              </Button>
              <Button type="submit" id="apply-filters" disabled={isLoading}>
                Terapkan
              </Button>
            </div>
          </div>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Tidak ada media yang cocok dengan filter saat ini.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
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
                ) : item.mimeType.startsWith("video/") ? (
                  <div className="relative h-full w-full bg-black/80">
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.title}
                        fill
                        className="object-cover opacity-80 transition group-hover:scale-105"
                        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
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
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {item.mimeType}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(item.size)} • {formatDate(item.createdAt)}
                  {item.mimeType.startsWith("video/") && item.duration
                    ? ` • ${formatDuration(item.duration)}`
                    : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {meta.totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Halaman {meta.page} dari {totalPagesDisplay} • Total {meta.total} media
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page <= 1 || isLoading}
            >
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= totalPagesDisplay || isLoading}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      <Modal open={Boolean(selectedItem)} onClose={closeModal}>
        {selectedItem ? (
          <div>
            <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 sm:flex-row">
              <div className="relative h-48 w-full overflow-hidden rounded-md bg-muted sm:w-1/2">
                {selectedItem.mimeType.startsWith("image/") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute right-3 top-3 z-10 shadow-md"
                    onClick={handleStartExistingCrop}
                    disabled={processingCrop}
                  >
                    {processingCrop ? "Memuat..." : "Crop"}
                  </Button>
                ) : null}
                {selectedItem.mimeType.startsWith("image/") ? (
                  <Image
                    src={selectedItem.thumbnailUrl ?? selectedItem.url}
                    alt={selectedItem.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />
                ) : selectedItem.mimeType.startsWith("video/") ? (
                  <video
                    key={selectedItem.id}
                    controls
                    poster={selectedItem.thumbnailUrl ?? undefined}
                    src={selectedItem.url}
                    className="h-full w-full bg-black object-contain"
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
              {selectedItem.mimeType.startsWith("video/") && selectedItem.duration ? (
                <p>
                  <span className="font-medium text-foreground">Durasi:</span> {formatDuration(selectedItem.duration)}
                </p>
              ) : null}
              <div className="space-y-2">
                <span className="font-medium text-foreground">Link media:</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    readOnly
                    value={selectedItem.url}
                    className="w-full font-mono text-xs text-foreground/80"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(selectedItem.url)}
                  >
                    Salin
                  </Button>
                </div>
              </div>
              {selectedItem.createdBy ? (
                <p>
                  <span className="font-medium text-foreground">Diunggah oleh:</span>{" "}
                  {selectedItem.createdBy.id === currentUserId
                    ? `${selectedItem.createdBy.name ?? selectedItem.createdBy.email ?? "Anda"} (Anda)`
                    : selectedItem.createdBy.name ?? selectedItem.createdBy.email ?? "Pengguna"}
                </p>
              ) : null}
            </div>
            {modalError ? <p className="px-4 text-sm text-destructive">{modalError}</p> : null}
            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="destructive" onClick={handleDelete} disabled={saving || deleting}>
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
