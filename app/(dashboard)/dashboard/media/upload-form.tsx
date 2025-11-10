"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { uploadMedia } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCroppedImage } from "@/lib/media/crop-image";

function isImageFile(file: File | null): file is File {
  return Boolean(file && file.type.startsWith("image/"));
}

export function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);

  const resetCropState = () => {
    setSelectedFile(null);
    setPreparedFile(null);
    setImagePreview(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsCropping(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setState({});

    if (!file) {
      resetCropState();
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({ error: "Ukuran file maksimal 5MB" });
      event.target.value = "";
      resetCropState();
      return;
    }

    if (isImageFile(file)) {
      setSelectedFile(file);
      setPreparedFile(null);
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImagePreview(reader.result as string);
        setIsCropping(true);
      });
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(file);
      setPreparedFile(file);
      setImagePreview(null);
      setIsCropping(false);
    }
  };

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imagePreview || !croppedAreaPixels || !selectedFile || !isImageFile(selectedFile)) {
      setState({ error: "Gagal menerapkan crop. Silakan coba lagi." });
      return;
    }

    try {
      const croppedFile = await getCroppedImage({
        imageSrc: imagePreview,
        cropArea: croppedAreaPixels,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
      });
      setPreparedFile(croppedFile);
      setIsCropping(false);
      setState((prev) => ({ ...prev, error: undefined, success: undefined }));
    } catch (error) {
      console.error(error);
      setState({ error: "Gagal memproses hasil crop. Coba ulangi." });
    }
  };

  const handleCancelCrop = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    resetCropState();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unggah Media</CardTitle>
        <CardDescription>Terima format gambar atau dokumen kecil, maksimal 5MB.</CardDescription>
      </CardHeader>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const file = form.get("file");
          const activeFile = preparedFile ?? (file instanceof File ? file : null);

          if (selectedFile && isImageFile(selectedFile) && !preparedFile) {
            setState({ error: "Simpan hasil crop terlebih dahulu sebelum mengunggah." });
            return;
          }

          if (activeFile && activeFile.size > MAX_FILE_SIZE_BYTES) {
            setState({ error: "Ukuran file maksimal 5MB" });
            return;
          }

          if (activeFile instanceof File) {
            form.set("file", activeFile, activeFile.name);
          }

          startTransition(async () => {
            const result = await uploadMedia(form);
            if (result?.error) {
              setState({ error: result.error });
              return;
            }
            formRef.current?.reset();
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            resetCropState();
            setState({ success: true, error: undefined });
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" placeholder="Poster Event" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" ref={fileInputRef} name="file" type="file" required onChange={handleFileChange} />
            {isCropping && imagePreview ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-3">
                <div className="relative h-64 w-full overflow-hidden rounded-lg bg-black/60">
                  <Cropper
                    image={imagePreview}
                    crop={crop}
                    zoom={zoom}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                    aspect={16 / 9}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Sesuaikan area crop lalu pilih <span className="font-semibold text-foreground">Simpan Crop</span>.
                  </p>
                  <label className="flex w-full flex-col gap-1 text-xs font-medium text-muted-foreground sm:w-auto sm:flex-1">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(event) => setZoom(Number(event.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none overflow-hidden rounded-full bg-muted"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={handleCancelCrop}>
                      Batal
                    </Button>
                    <Button type="button" size="sm" onClick={handleApplyCrop}>
                      Simpan Crop
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {!isCropping && preparedFile && isImageFile(selectedFile) ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-3 text-xs text-foreground sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">
                  Hasil crop siap diunggah: <span className="font-semibold">{preparedFile.name}</span>
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => setIsCropping(true)}>
                  Edit Crop
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Media berhasil diunggah.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Mengunggah..." : "Unggah"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
