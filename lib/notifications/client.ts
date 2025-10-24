"use client";

export type NotificationVariant = "success" | "error" | "info" | "warning";

export type NotificationPayload = {
  id?: string;
  title: string;
  description?: string;
  variant?: NotificationVariant;
  duration?: number;
};

export const DASHBOARD_NOTIFICATION_EVENT = "dashboard-notification";

function emitNotification(payload: NotificationPayload) {
  if (typeof window === "undefined") return;
  const detail = {
    id: crypto.randomUUID(),
    duration: 3000,
    variant: "info" as NotificationVariant,
    ...payload,
  };
  window.dispatchEvent(new CustomEvent(DASHBOARD_NOTIFICATION_EVENT, { detail }));
}

export function notify(payload: NotificationPayload) {
  emitNotification(payload);
}

export function notifySuccess(description: string, title = "Berhasil") {
  emitNotification({ title, description, variant: "success" });
}

export function notifyError(description: string, title = "Terjadi Kesalahan") {
  emitNotification({ title, description, variant: "error" });
}

export function notifyInfo(description: string, title = "Informasi") {
  emitNotification({ title, description, variant: "info" });
}

export function notifyWarning(description: string, title = "Perhatian") {
  emitNotification({ title, description, variant: "warning" });
}
