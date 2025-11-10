import Image from "next/image";
import { Play } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type MediaItem = {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  createdAt: string | Date;
};

type MediaGridProps = {
  items: MediaItem[];
  onDelete?: (formData: FormData) => Promise<void>;
  filter?: "all" | "images";
};

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function MediaGrid({ items, onDelete, filter = "all" }: MediaGridProps) {
  const filteredItems =
    filter === "images" ? items.filter((item) => item.mimeType.startsWith("image/")) : items;

  if (filteredItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum ada media</CardTitle>
          <CardDescription>Unggah gambar atau dokumen untuk mengisi galeri.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredItems.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
            <CardDescription className="flex items-center justify-between text-xs">
              <span>{formatSize(item.size)}</span>
              <span>{new Date(item.createdAt).toLocaleDateString("id-ID")}</span>
            </CardDescription>
            {item.description ? (
              <CardDescription className="text-xs text-muted-foreground">
                {item.description}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="flex items-center justify-center bg-muted/40">
            {item.mimeType.startsWith("image/") ? (
              <Image
                src={item.thumbnailUrl ?? item.url}
                alt={item.title}
                width={300}
                height={200}
                className="h-auto max-h-48 w-full rounded-md object-cover"
              />
            ) : item.mimeType.startsWith("video/") ? (
              <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md border border-border/50 bg-black/75">
                {item.thumbnailUrl ? (
                  <Image
                    src={item.thumbnailUrl}
                    alt={item.title}
                    fill
                    className="object-cover opacity-80"
                  />
                ) : null}
                <div className="relative z-10 flex flex-col items-center justify-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white">
                  <Play className="h-6 w-6" />
                  <span>{item.mimeType}</span>
                  {item.duration ? (
                    <span className="text-[10px] uppercase tracking-wide text-white/80">
                      {formatDuration(item.duration)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                {item.mimeType}
              </div>
            )}
          </CardContent>
          {onDelete ? (
            <CardFooter>
              <form action={onDelete} className="w-full">
                <input type="hidden" name="id" value={item.id} />
                <Button variant="destructive" size="sm" className="w-full" type="submit">
                  Hapus
                </Button>
              </form>
            </CardFooter>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
