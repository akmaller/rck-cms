"use client";

import { Copy, Facebook, Instagram, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ComponentType } from "react";

import { buttonVariants } from "@/lib/button-variants";
import { cn, ensureTrailingSlash } from "@/lib/utils";

type ShareChannel = "twitter" | "facebook" | "whatsapp" | "telegram";

type ShareActionsProps = {
  title: string;
  articleUrl: string;
  slug: string;
  className?: string;
};

type InstagramDownloadState = "idle" | "loading" | "success" | "error";

const XLetterIcon: ComponentType<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    role="img"
    aria-hidden="true"
    focusable="false"
  >
    <text
      x="12"
      y="18"
      textAnchor="middle"
      fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
      fontSize="18"
      fontWeight="800"
      fill="currentColor"
    >
      X
    </text>
  </svg>
);

function buildShareUrl(channel: ShareChannel, title: string, url: string) {
  const normalizedUrl = ensureTrailingSlash(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(normalizedUrl);

  switch (channel) {
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
    default:
      return normalizedUrl;
  }
}

export function ShareActions({ title, articleUrl, slug, className }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [instagramDownloadState, setInstagramDownloadState] =
    useState<InstagramDownloadState>("idle");
  const normalizedArticleUrl = ensureTrailingSlash(articleUrl);
  const shareMessage = useMemo(
    () => `${title} — ${normalizedArticleUrl}`,
    [title, normalizedArticleUrl]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error("Gagal menyalin tautan artikel:", error);
    }
  }, [shareMessage]);

  const handleInstagramDownload = useCallback(async () => {
    if (!slug) {
      return;
    }
    setInstagramDownloadState("loading");
    const scheduleReset = () => {
      setTimeout(() => {
        setInstagramDownloadState("idle");
      }, 2500);
    };

    try {
      const response = await fetch(
        `/api/public/articles/${encodeURIComponent(slug)}/share-instagram?articleUrl=${encodeURIComponent(
          normalizedArticleUrl
        )}`
      );
      if (!response.ok) {
        throw new Error(`Gagal menyiapkan gambar Instagram: ${response.statusText}`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${slug}-instagram-feed.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setInstagramDownloadState("success");
      scheduleReset();
    } catch (error) {
      console.error(error);
      setInstagramDownloadState("error");
      scheduleReset();
    }
  }, [normalizedArticleUrl, slug]);

  const shareButtons: Array<{ channel: ShareChannel; label: string; Icon: ComponentType<{ className?: string }> }> = [
    {
      channel: "twitter" as ShareChannel,
      label: "Bagikan ke Twitter / X",
      Icon: XLetterIcon,
    },
    {
      channel: "facebook" as ShareChannel,
      label: "Bagikan ke Facebook",
      Icon: Facebook,
    },
    {
      channel: "whatsapp" as ShareChannel,
      label: "Bagikan ke WhatsApp",
      Icon: MessageCircle,
    },
    {
      channel: "telegram" as ShareChannel,
      label: "Bagikan ke Telegram",
      Icon: Send,
    },
  ];

  const instagramButtonLabel =
    instagramDownloadState === "loading"
      ? "Sedang menyiapkan gambar Instagram"
      : instagramDownloadState === "success"
        ? "Gambar Instagram siap diunggah"
        : instagramDownloadState === "error"
          ? "Gagal menyiapkan gambar Instagram, coba lagi"
          : "Unduh template Instagram";

  const copyButtonLabel = copied ? "Tautan artikel berhasil disalin" : "Salin tautan artikel";

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        className
      )}
    >
      <span className="text-sm font-semibold text-muted-foreground sm:text-foreground flex-none">
        Bagikan:
      </span>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto sm:flex-none">
        {shareButtons.map(({ channel, label, Icon }) => (
          <Link
            key={channel}
            href={buildShareUrl(channel, title, normalizedArticleUrl)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={buttonVariants({
              variant: "outline",
              size: "icon",
            })}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={handleInstagramDownload}
          disabled={instagramDownloadState === "loading"}
          aria-label={instagramButtonLabel}
          title={instagramButtonLabel}
          className={buttonVariants({
            variant:
              instagramDownloadState === "success"
                ? "secondary"
                : instagramDownloadState === "error"
                  ? "destructive"
                  : "default",
            size: "icon",
          })}
        >
          <Instagram className="h-4 w-4" aria-hidden />
          <span className="sr-only">Instagram Feed</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyButtonLabel}
          title={copyButtonLabel}
          className={buttonVariants({
            variant: copied ? "secondary" : "outline",
            size: "icon",
          })}
        >
          <Copy className="h-4 w-4" aria-hidden />
          <span className="sr-only">{copied ? "Tautan berhasil disalin" : "Salin tautan"}</span>
        </button>
      </div>
    </div>
  );
}
