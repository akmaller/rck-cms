"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type TurnstileRenderOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  action?: string;
  cdata?: string;
};

type TurnstileFieldProps = {
  siteKey?: string | null;
  onTokenChange?: (token: string) => void;
  tokenFieldName?: string;
  className?: string;
  action?: string;
  cData?: string;
  resetKey?: number;
  developmentMessage?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

const DEFAULT_TOKEN_FIELD = "turnstileToken";
const DEFAULT_ACTIVE_MESSAGE = "Form ini dilindungi Cloudflare";

export function TurnstileField({
  siteKey,
  onTokenChange,
  tokenFieldName = DEFAULT_TOKEN_FIELD,
  className,
  action,
  cData,
  resetKey,
  developmentMessage = DEFAULT_ACTIVE_MESSAGE,
}: TurnstileFieldProps) {
  const [token, setToken] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadingRef = useRef<Promise<void> | null>(null);

  const normalizedSiteKey = typeof siteKey === "string" && siteKey.trim().length > 0 ? siteKey.trim() : null;

  const handleTokenChange = useCallback(
    (value: string) => {
      setToken(value);
      onTokenChange?.(value);
    },
    [onTokenChange]
  );

  useEffect(() => {
    if (!normalizedSiteKey) {
      const timer = window.setTimeout(() => handleTokenChange(""), 0);
      return () => window.clearTimeout(timer);
    }

    const renderTurnstile = () => {
      if (!window.turnstile || !containerRef.current) {
        return;
      }

      if (widgetIdRef.current) {
        window.turnstile.reset?.(widgetIdRef.current);
        return;
      }

      handleTokenChange("");
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: `${normalizedSiteKey}`,
        action,
        cdata: cData,
        callback: (newToken) => handleTokenChange(newToken),
        "expired-callback": () => handleTokenChange(""),
        "error-callback": () => handleTokenChange(""),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-turnstile-script]");
    if (existingScript) {
      const loadHandler = () => renderTurnstile();
      existingScript.addEventListener("load", loadHandler);
      if (window.turnstile) {
        renderTurnstile();
      }
      return () => existingScript.removeEventListener("load", loadHandler);
    }

    if (!scriptLoadingRef.current) {
      scriptLoadingRef.current = new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = "true";
        script.addEventListener("load", () => resolve());
        document.body.appendChild(script);
      });
    }

    let cancelled = false;
    scriptLoadingRef.current.then(() => {
      if (!cancelled) {
        renderTurnstile();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedSiteKey, action, cData, handleTokenChange]);

  useEffect(() => {
    if (!normalizedSiteKey) {
      return;
    }
    if (!resetKey) {
      return;
    }
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset?.(widgetIdRef.current);
    }
  }, [resetKey, normalizedSiteKey]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove?.(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [normalizedSiteKey]);

  return (
    <>
      {normalizedSiteKey ? (
        <div className="space-y-1">
          <div ref={containerRef} className={cn("cf-turnstile", className)} />
          <p className="text-xs text-muted-foreground">{developmentMessage}</p>
        </div>
      ) : null}
      <input type="hidden" name={tokenFieldName} value={token} />
    </>
  );
}
