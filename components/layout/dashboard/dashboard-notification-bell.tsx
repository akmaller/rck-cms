"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Loader2, MessageCircle, Reply, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/datetime/relative";

type NotificationType =
  | "ARTICLE_COMMENT"
  | "COMMENT_REPLY"
  | "ARTICLE_LIKE"
  | "COMMENT_LIKE";

type NotificationActor = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

type NotificationArticle = {
  id: string;
  slug: string;
  title: string;
} | null;

type NotificationComment = {
  id: string;
  content: string;
  article: NotificationArticle;
} | null;

type NotificationItem = {
  id: string;
  type: NotificationType;
  articleId: string | null;
  commentId: string | null;
  createdAt: Date;
  readAt: Date | null;
  actor: NotificationActor;
  article: NotificationArticle;
  comment: NotificationComment;
};

type FetchResponse = {
  data: Array<
    Omit<NotificationItem, "createdAt" | "readAt"> & {
      createdAt: string;
      readAt: string | null;
    }
  >;
  unreadCount: number;
  nextCursor: string | null;
};

type NotificationPresentation = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  meta?: string | null;
  articlePreview?: string | null;
};

function getActorDisplayName(actor: NotificationActor) {
  return actor.name?.trim() || "Seseorang";
}

function buildNotificationPresentation(item: NotificationItem): NotificationPresentation {
  const actorName = getActorDisplayName(item.actor);
  const articleTitle = item.article?.title ?? item.comment?.article?.title ?? "Artikel";
  const commentText = item.comment?.content ?? "";
  const articleSlug = item.article?.slug ?? "";
  const baseHref = articleSlug ? `/articles/${articleSlug}` : "/";
  const commentAnchor = item.commentId ? `#comment-${item.commentId}` : "#artikel-komentar";
  const href = `${baseHref}${item.type === "ARTICLE_LIKE" ? "" : commentAnchor}`;

  const commentPreview = commentText
    ? commentText.length > 140
      ? `${commentText.slice(0, 137)}...`
      : commentText
    : null;
  const articlePreview = articleTitle.length > 37 ? `${articleTitle.slice(0, 37)}...` : articleTitle;

  switch (item.type) {
    case "ARTICLE_COMMENT":
      return {
        title: `${actorName} mengomentari artikel Anda`,
        description: commentPreview ?? "Komentar baru",
        href,
        icon: <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />,
        meta: articleTitle,
        articlePreview,
      };
    case "COMMENT_REPLY":
      return {
        title: `${actorName} membalas komentar Anda`,
        description: commentPreview ?? "Balasan baru",
        href,
        icon: <Reply className="h-4 w-4 text-primary" aria-hidden="true" />,
        meta: articleTitle,
        articlePreview,
      };
    case "ARTICLE_LIKE":
      return {
        title: `${actorName} menyukai artikel Anda`,
        description: articleTitle,
        href: baseHref,
        icon: <ThumbsUp className="h-4 w-4 text-primary" aria-hidden="true" />,
        meta: null,
        articlePreview,
      };
    case "COMMENT_LIKE":
    default:
      return {
        title: `${actorName} menyukai komentar Anda`,
        description: commentPreview ?? "Komentar Anda disukai",
        href,
        icon: <ThumbsUp className="h-4 w-4 text-primary" aria-hidden="true" />,
        meta: articleTitle,
        articlePreview,
      };
  }
}

export function DashboardNotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialNotifications() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "10" });
        const response = await fetch(`/api/dashboard/notifications?${params.toString()}`, {
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error("Gagal memuat notifikasi.");
        }
        const payload = (await response.json()) as FetchResponse;
        if (cancelled) return;
        setNotifications(
          payload.data.map((item) => ({
            ...item,
            createdAt: new Date(item.createdAt),
            readAt: item.readAt ? new Date(item.readAt) : null,
          }))
        );
        setUnreadCount(payload.unreadCount);
        setNextCursor(payload.nextCursor);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch notifications", err);
        setError("Tidak dapat memuat notifikasi.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    fetchInitialNotifications();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
    if (unreadIds.length === 0) {
      return;
    }
    setIsMarking(true);
    setError(null);

    let cancelled = false;

    async function markAsRead() {
      try {
        const response = await fetch("/api/dashboard/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ids: unreadIds }),
        });
        if (!response.ok) {
          throw new Error("Gagal memperbarui status notifikasi.");
        }
        if (cancelled) return;
        setNotifications((prev) =>
          prev.map((item) =>
            unreadIds.includes(item.id) ? { ...item, readAt: new Date() } : item
          )
        );
        setUnreadCount(0);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to mark notifications as read", err);
        setError("Gagal menandai notifikasi sebagai telah dibaca.");
      } finally {
        if (!cancelled) {
          setIsMarking(false);
        }
      }
    }

    markAsRead();

    return () => {
      cancelled = true;
    };
  }, [isOpen, notifications]);

  const hasNotifications = notifications.length > 0;
  const badgeContent = useMemo(() => {
    if (unreadCount <= 0) {
      return null;
    }
    return unreadCount > 99 ? "99+" : unreadCount.toString();
  }, [unreadCount]);

  const handleRefresh = () => {
    if (isLoading) {
      return;
    }
    setRefreshToken((prev) => prev + 1);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "10", cursor: nextCursor });
      const response = await fetch(`/api/dashboard/notifications?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("Gagal memuat notifikasi tambahan.");
      }
      const payload = (await response.json()) as FetchResponse;
      const mapped = payload.data.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        readAt: item.readAt ? new Date(item.readAt) : null,
      }));
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const appended = mapped.filter((item) => !existingIds.has(item.id));
        return [...prev, ...appended];
      });
      setUnreadCount(payload.unreadCount);
      setNextCursor(payload.nextCursor);
    } catch (err) {
      console.error("Failed to load more notifications", err);
      setError("Tidak dapat memuat notifikasi tambahan.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Notifikasi"
        className={cn("relative", isOpen ? "bg-accent" : "")}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {badgeContent ? (
          <span className="absolute -top-1.5 -right-1.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sky-500 px-1 text-[11px] font-semibold text-white">
            {badgeContent}
          </span>
        ) : null}
      </Button>
      {isOpen ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-xs rounded-lg border border-border/70 bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <p className="text-sm font-semibold text-foreground">Notifikasi</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-primary transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                Muat ulang
              </button>
              {isMarking ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Memperbarui
                </span>
              ) : null}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto px-1 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Memuat notifikasi...
              </div>
            ) : error ? (
              <p className="px-3 py-4 text-sm text-destructive">{error}</p>
            ) : hasNotifications ? (
              <>
                {notifications.map((item) => {
                  const presentation = buildNotificationPresentation(item);
                  const relativeTime = formatRelativeTime(item.createdAt);
                  return (
                    <Link
                      href={presentation.href}
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-muted/80",
                      !item.readAt ? "bg-primary/5" : ""
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {item.actor.avatarUrl ? (
                        <Image
                          src={item.actor.avatarUrl}
                          alt={getActorDisplayName(item.actor)}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                          sizes="32px"
                        />
                      ) : (
                        presentation.icon
                      )}
                    </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{presentation.title}</p>
                    <p className="text-xs text-muted-foreground">{presentation.description}</p>
                    {presentation.meta ? (
                      <p className="text-[11px] text-muted-foreground/80 italic">
                        {presentation.articlePreview ?? presentation.meta}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{relativeTime}</p>
                  </div>
                      {!item.readAt ? (
                        <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
                      ) : null}
                    </Link>
                  );
                })}
                {nextCursor ? (
                  <div className="px-3 pb-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Memuat...
                        </span>
                      ) : (
                        "Muat lagi"
                      )}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="px-3 py-6 text-sm text-muted-foreground">Belum ada notifikasi.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
