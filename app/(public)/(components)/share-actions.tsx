"use client";

import {
  Copy,
  Facebook,
  Linkedin,
  Mail,
  MessageCircle,
  Send,
  Share2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { buttonVariants } from "@/lib/button-variants";
import { cn, ensureTrailingSlash } from "@/lib/utils";

type ShareChannel = "twitter" | "facebook" | "whatsapp" | "telegram" | "linkedin" | "email";

type ShareActionsProps = {
  title: string;
  articleUrl: string;
  className?: string;
};

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
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "email":
      return `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;
    default:
      return normalizedUrl;
  }
}

export function ShareActions({ title, articleUrl, className }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);
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

  const shareButtons: Array<{ channel: ShareChannel; label: string; Icon: LucideIcon }> = [
    {
      channel: "twitter" as ShareChannel,
      label: "Twitter / X",
      Icon: Share2,
    },
    {
      channel: "facebook" as ShareChannel,
      label: "Facebook",
      Icon: Facebook,
    },
    {
      channel: "whatsapp" as ShareChannel,
      label: "WhatsApp",
      Icon: MessageCircle,
    },
    {
      channel: "telegram" as ShareChannel,
      label: "Telegram",
      Icon: Send,
    },
    {
      channel: "linkedin" as ShareChannel,
      label: "LinkedIn",
      Icon: Linkedin,
    },
    {
      channel: "email" as ShareChannel,
      label: "Email",
      Icon: Mail,
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 md:flex-nowrap",
        className
      )}
    >
      <span className="col-span-2 text-sm font-semibold text-muted-foreground sm:w-auto sm:text-foreground sm:flex-none">
        Bagikan:
      </span>
      {shareButtons.map(({ channel, label, Icon }) => (
        <Link
          key={channel}
          href={buildShareUrl(channel, title, normalizedArticleUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "flex w-full items-center justify-center gap-2 text-sm font-medium sm:w-auto sm:flex-none",
          })}
        >
          <Icon className="h-4 w-4" aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        className={buttonVariants({
          variant: "secondary",
          size: "sm",
          className: "flex w-full items-center justify-center gap-2 text-sm font-medium sm:w-auto sm:flex-none",
        })}
      >
        <Copy className="h-4 w-4" aria-hidden />
        <span>{copied ? "Disalin!" : "Salin Judul & Tautan"}</span>
      </button>
    </div>
  );
}
