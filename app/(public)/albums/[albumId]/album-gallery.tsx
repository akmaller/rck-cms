"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type GalleryImage = {
  id: string;
  url: string;
  title: string;
  caption?: string | null;
  width?: number;
  height?: number;
};

type AlbumGalleryProps = {
  albumTitle: string;
  images: GalleryImage[];
};

export function AlbumGallery({ albumTitle, images }: AlbumGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeImage = useMemo(() => {
    if (activeIndex === null || activeIndex < 0 || activeIndex >= images.length) {
      return null;
    }
    return images[activeIndex];
  }, [activeIndex, images]);

  useEffect(() => {
    if (activeImage) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setActiveIndex(null);
        } else if (event.key === "ArrowRight") {
          setActiveIndex((prev) => {
            if (prev === null) return 0;
            return prev + 1 < images.length ? prev + 1 : prev;
          });
        } else if (event.key === "ArrowLeft") {
          setActiveIndex((prev) => {
            if (prev === null) return 0;
            return prev - 1 >= 0 ? prev - 1 : prev;
          });
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [activeImage, images.length]);

  if (images.length === 0) {
    return null;
  }

  const currentIndex = activeIndex ?? 0;

  return (
    <>
      {albumTitle ? (
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {albumTitle}
        </h2>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg"
          >
            <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
              <Image
                src={image.url}
                alt={image.caption?.trim() || image.title || `Foto ${index + 1}`}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                priority={index < 6}
              />
            </div>
            {image.caption ? (
              <div className="px-3 py-3">
                <p className="line-clamp-2 text-xs text-muted-foreground">{image.caption}</p>
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {activeImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => setActiveIndex(null)}
          />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-base font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-primary"
              aria-label="Tutup pratinjau"
            >
              ×
            </button>
            <div className="flex max-h-[90vh] flex-col gap-4 p-4 sm:p-6">
              <div className="relative flex flex-1 items-center justify-center">
                <div className="relative aspect-[4/3] w-full max-h-[70vh] min-h-[240px] overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={activeImage.url}
                    alt={activeImage.caption?.trim() || activeImage.title}
                    fill
                    className="object-contain"
                    sizes="(min-width: 1280px) 1024px, (min-width: 768px) 80vw, 90vw"
                    priority
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) => {
                      if (prev === null) return prev;
                      return prev > 0 ? prev - 1 : prev;
                    })
                  }
                  className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground shadow transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 sm:block"
                  disabled={currentIndex === 0}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) =>
                      prev !== null && prev + 1 < images.length ? prev + 1 : prev
                    )
                  }
                  className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground shadow transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 sm:block"
                  disabled={currentIndex === images.length - 1}
                >
                  Berikutnya
                </button>
              </div>
              {activeImage.caption ? (
                <p className="text-sm text-muted-foreground">{activeImage.caption}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Foto {currentIndex + 1} dari {images.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-border/60 px-3 py-1 text-sm font-medium transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() =>
                      setActiveIndex((prev) => {
                        if (prev === null) return prev;
                        return prev > 0 ? prev - 1 : prev;
                      })
                    }
                    disabled={currentIndex === 0}
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-border/60 px-3 py-1 text-sm font-medium transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() =>
                      setActiveIndex((prev) =>
                        prev !== null && prev + 1 < images.length ? prev + 1 : prev
                      )
                    }
                    disabled={currentIndex === images.length - 1}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
