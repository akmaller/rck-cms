"use client";

import { useState } from "react";
import Image from "next/image";

import { MediaItem } from "@/components/media/media-grid";
import { Button } from "@/components/ui/button";

export type MediaPickerProps = {
  items: MediaItem[];
  value?: string | null;
  onSelect: (id: string | null) => void;
};

export function MediaPicker({ items, value, onSelect }: MediaPickerProps) {
  const [selected, setSelected] = useState<string | null>(value ?? null);

  const handleSelect = (id: string | null) => {
    setSelected(id);
    onSelect(id);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => handleSelect(item.id === selected ? null : item.id)}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition hover:border-primary/50 ${
              selected === item.id ? "border-primary ring-2 ring-primary/40" : "border-border/60"
            }`}
          >
            {item.mimeType.startsWith("image/") ? (
              <Image
                src={item.url}
                alt={item.title}
                width={64}
                height={64}
                className="h-16 w-16 rounded object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                {item.mimeType}
              </div>
            )}
            <div className="truncate text-sm">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("id-ID")}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => handleSelect(null)}>
          Hapus pilihan
        </Button>
      </div>
    </div>
  );
}
