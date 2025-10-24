"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type NavigationType = "push" | "back";

type UnsavedPromptOptions = {
  isDirty: boolean;
  onSaveAndExit?: (targetUrl: string | null) => Promise<boolean>;
};

const isExternalUrl = (url: string) => {
  if (typeof window === "undefined") return false;
  if (/^https?:\/\//i.test(url)) {
    return !url.startsWith(window.location.origin);
  }
  return false;
};

export function useUnsavedChangesPrompt({ isDirty, onSaveAndExit }: UnsavedPromptOptions) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(() => typeof window !== "undefined");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingUrlRef = useRef<string | null>(null);
  const navigationTypeRef = useRef<NavigationType>("push");
  const allowNavigationRef = useRef(false);
  const dirtyRef = useRef(isDirty);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const id = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });

    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    if (dirtyRef.current) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const isModifiedEvent = (event: MouseEvent | PointerEvent | KeyboardEvent | TouchEvent) => {
      if ("metaKey" in event && event.metaKey) return true;
      if ("ctrlKey" in event && event.ctrlKey) return true;
      if ("shiftKey" in event && event.shiftKey) return true;
      if ("altKey" in event && event.altKey) return true;
      return false;
    };

    const findAnchor = (target: EventTarget | null): HTMLAnchorElement | null => {
      if (!(target instanceof Element)) return null;
      if (target.tagName === "A") return target as HTMLAnchorElement;
      return target.closest("a");
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!dirtyRef.current || allowNavigationRef.current || event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || isModifiedEvent(event)) {
        return;
      }

      const anchor = findAnchor(event.target);
      if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") {
        return;
      }

      const href = anchor.href;
      if (!href) {
        return;
      }

      if (anchor.dataset.unsaved === "ignore") {
        return;
      }

      const isLocal = href.startsWith(window.location.origin);
      if (!isLocal) {
        return;
      }

      if (href === window.location.href) {
        return;
      }

      event.preventDefault();
      pendingUrlRef.current = href;
      navigationTypeRef.current = "push";
      setDialogOpen(true);
    };

    const handlePopState = (event: PopStateEvent) => {
      if (allowNavigationRef.current || !dirtyRef.current) {
        allowNavigationRef.current = false;
        return;
      }

      if ((event.state as { __unsaved_guard__?: boolean } | null)?.__unsaved_guard__) {
        return;
      }

      history.pushState({ __unsaved_guard__: true }, "", window.location.href);
      pendingUrlRef.current = null;
      navigationTypeRef.current = "back";
      setDialogOpen(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    history.replaceState({ __unsaved_guard__: true }, "", window.location.href);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const resetDialogState = useCallback(() => {
    setDialogOpen(false);
    setIsSaving(false);
    pendingUrlRef.current = null;
    navigationTypeRef.current = "push";
  }, []);

  const handleStay = useCallback(() => {
    resetDialogState();
  }, [resetDialogState]);

  const proceedTo = useCallback(
    (target: string | null, type: NavigationType) => {
      if (type === "back") {
        window.history.back();
        return;
      }

      if (!target) {
        return;
      }

      if (isExternalUrl(target)) {
        window.location.href = target;
        return;
      }

      router.push(target);
    },
    [router]
  );

  const handleDiscard = useCallback(() => {
    const target = pendingUrlRef.current;
    const type = navigationTypeRef.current;
    resetDialogState();
    allowNavigationRef.current = true;
    proceedTo(target, type);
    allowNavigationRef.current = false;
  }, [proceedTo, resetDialogState]);

  const handleSave = useCallback(async () => {
    if (!onSaveAndExit) {
      handleDiscard();
      return;
    }
    const target = pendingUrlRef.current;
    if (!target && navigationTypeRef.current !== "back") {
      resetDialogState();
      return;
    }

    try {
      setIsSaving(true);
      allowNavigationRef.current = true;
      const success = await onSaveAndExit(target);
      if (!success) {
        allowNavigationRef.current = false;
        setIsSaving(false);
        return;
      }
      resetDialogState();
      allowNavigationRef.current = false;
    } catch (error) {
      console.error(error);
      allowNavigationRef.current = false;
      setIsSaving(false);
    }
  }, [handleDiscard, onSaveAndExit, resetDialogState]);

  const dialog = useMemo<ReactNode>(() => {
    if (!isMounted || !dialogOpen) {
      return null;
    }

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="absolute inset-0" aria-hidden onClick={handleStay} />
        <Card
          role="dialog"
          aria-modal="true"
          className="relative z-10 w-full max-w-lg border-border/80 bg-background"
        >
          <CardHeader>
            <CardTitle>Perubahan belum disimpan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Anda memiliki perubahan yang belum disimpan. Keluar sekarang akan menghapus
              perubahan tersebut.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={handleStay} className="w-full sm:w-auto">
              Tetap di halaman
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscard}
              className="w-full sm:w-auto"
            >
              Abaikan dan keluar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? "Menyimpan..." : "Simpan lalu keluar"}
            </Button>
          </CardFooter>
        </Card>
      </div>,
      document.body
    );
  }, [dialogOpen, handleDiscard, handleSave, handleStay, isMounted, isSaving]);

  return { dialog };
}
