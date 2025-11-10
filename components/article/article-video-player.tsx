"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ArticleVideoPlayerProps = {
  src: string;
  mimeType?: string | null;
  poster?: string | null;
  title: string;
  className?: string;
  preload?: "auto" | "metadata" | "none";
};

export function ArticleVideoPlayer({
  src,
  mimeType,
  poster,
  className,
  preload = "metadata",
}: ArticleVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const normalizedType = useMemo(() => {
    if (!mimeType) return null;
    const lower = mimeType.toLowerCase();
    if (lower.startsWith("video/") || lower.startsWith("audio/")) {
      return lower;
    }
    if (
      lower === "application/vnd.apple.mpegurl" ||
      lower === "application/x-mpegurl" ||
      lower === "application/dash+xml"
    ) {
      return lower;
    }
    return null;
  }, [mimeType]);

  const handlePlayRequest = useCallback(() => {
    const node = videoRef.current;
    if (!node) {
      return;
    }
    setHasError(false);
    setErrorInfo(null);
    setIsLoading(true);
    void node.play().catch((error) => {
      setHasError(true);
      const mediaError = node.error;
      if (mediaError) {
        setErrorInfo(describeMediaError(mediaError));
      } else if (error instanceof Error && error.message) {
        setErrorInfo(error.message);
      }
      setIsLoading(false);
    });
  }, []);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black",
        className
      )}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        poster={poster ?? undefined}
        preload={preload}
        playsInline
        controls
        controlsList="nodownload"
        onPlay={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onLoadedData={() => setIsLoading(false)}
        onError={(event) => {
          setHasError(true);
          const mediaError = event.currentTarget.error;
          if (mediaError) {
            setErrorInfo(describeMediaError(mediaError));
          } else {
            setErrorInfo("MEDIA_ERR_UNKNOWN");
          }
          setIsLoading(false);
        }}
      >
        <source src={src} type={normalizedType ?? undefined} />
        {normalizedType ? null : <source src={src} />}
        Your browser does not support the video tag.
      </video>

      {!isPlaying ? (
        <button
          type="button"
          className="group absolute inset-0 flex items-center justify-center bg-black/50 transition hover:bg-black/60"
          onClick={handlePlayRequest}
          aria-label="Putar video"
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-105 md:h-20 md:w-20">
            ▶
          </span>
        </button>
      ) : null}

      {isLoading && !hasError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      ) : null}

      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center text-sm text-white">
          <p className="font-semibold">Video tidak dapat diputar.</p>
          <p className="text-xs text-white/70">
            Coba muat ulang halaman atau unggah ulang video dengan format MP4/WEBM.
          </p>
          {errorInfo ? (
            <p className="text-[11px] uppercase tracking-wide text-red-300">{errorInfo}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function describeMediaError(error: MediaError): string {
  let label: string;
  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      label = "MEDIA_ERR_ABORTED";
      break;
    case MediaError.MEDIA_ERR_NETWORK:
      label = "MEDIA_ERR_NETWORK";
      break;
    case MediaError.MEDIA_ERR_DECODE:
      label = "MEDIA_ERR_DECODE";
      break;
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      label = "MEDIA_ERR_SRC_NOT_SUPPORTED";
      break;
    default:
      label = "MEDIA_ERR_UNKNOWN";
      break;
  }
  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? `: ${error.message.trim()}`
      : "";
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.error(`[VideoPlayer] ${label} (code ${error.code})${message}`, error);
  }
  return `${label} (code ${error.code})${message}`;
}
