"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, UploadCloud, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

import { updateAvatar } from "./actions";

type AvatarUploaderProps = {
  initialAvatarUrl: string | null;
  userName: string;
};

const MAX_SIZE_MB = 3;

export function AvatarUploader({ initialAvatarUrl, userName }: AvatarUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      const message = `Ukuran gambar maksimal ${MAX_SIZE_MB}MB.`;
      setStatus({ type: "error", message });
      notifyError(message);
      return;
    }

    if (!file.type.startsWith("image/")) {
      const message = "Hanya file gambar yang diperbolehkan.";
      setStatus({ type: "error", message });
      notifyError(message);
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setStatus(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      const message = "Pilih gambar terlebih dahulu.";
      setStatus({ type: "error", message });
      notifyError(message);
      return;
    }

    const formData = new FormData();
    formData.append("avatar", selectedFile);

    startTransition(async () => {
      const result = await updateAvatar(formData);
      if (!result.success) {
        const message = result.message ?? "Gagal memperbarui foto profil.";
        setStatus({ type: "error", message });
        notifyError(message);
        return;
      }

      setStatus({ type: "success", message: result.message });
      notifySuccess(result.message);
      setSelectedFile(null);
      setPreviewUrl(result.url ?? null);
    });
  };

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Foto Profil</CardTitle>
        <CardDescription>
          Unggah foto terbaru Anda. Gambar akan dikompres maksimal 350px agar ringan di dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={`Foto profil ${userName}`}
                fill
                unoptimized
                className="object-cover"
                sizes="128px"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent text-3xl font-semibold text-accent-foreground">
                {initials || <User className="h-10 w-10" />}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <p>Format: JPG, PNG, atau WebP · Maksimal {MAX_SIZE_MB}MB</p>
            <p>Resolusi akan diubah otomatis ke maks 350px.</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => handleFileSelect(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Pilih Foto
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !selectedFile}
            className="gap-2"
          >
            <UploadCloud className="h-4 w-4" />
            {isPending ? "Mengunggah..." : "Unggah Foto"}
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        {status ? (
          <p
            className={`text-sm ${
              status.type === "success" ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {status.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Gunakan foto persegi agar tampilan tetap proporsional.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
