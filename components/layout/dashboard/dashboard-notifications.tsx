"use client";

import { useEffect, useState } from "react";

import { DASHBOARD_NOTIFICATION_EVENT, type NotificationPayload, type NotificationVariant } from "@/lib/notifications/client";
import { cn } from "@/lib/utils";

type InternalNotification = Required<Pick<NotificationPayload, "id" | "title">> &
  Pick<NotificationPayload, "description" | "variant" | "duration">;

const variantStyles: Record<NotificationVariant, string> = {
  success: "border-emerald-500 bg-emerald-500/10 text-emerald-500",
  error: "border-red-500 bg-red-500/10 text-red-500",
  info: "border-sky-500 bg-sky-500/10 text-sky-500",
  warning: "border-amber-500 bg-amber-500/10 text-amber-500",
};

export function DashboardNotifications() {
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<InternalNotification>).detail;
      if (!detail?.id) return;
      setNotifications((prev) => [...prev, detail]);
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== detail.id));
      }, detail.duration ?? 3000);
    };

    window.addEventListener(DASHBOARD_NOTIFICATION_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(DASHBOARD_NOTIFICATION_EVENT, handler as EventListener);
    };
  }, []);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-xs flex-col gap-3 sm:max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "pointer-events-auto overflow-hidden rounded-lg border px-4 py-3 shadow-lg backdrop-blur",
            variantStyles[notification.variant ?? "info"]
          )}
        >
          <p className="text-sm font-semibold">{notification.title}</p>
          {notification.description ? (
            <p className="mt-1 text-xs text-foreground/80">{notification.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
