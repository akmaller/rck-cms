import Image from "next/image";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type MediaItem = {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  mimeType: string;
  size: number;
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
              <Image src={item.url} alt={item.title} width={300} height={200} className="h-auto max-h-48 w-full rounded-md object-cover" />
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
