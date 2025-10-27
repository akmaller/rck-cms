"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordResetAction, type ForgotPasswordActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId?: string) => void;
    };
  }
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Memproses..." : "Kirim Tautan Reset"}
    </Button>
  );
}

type ForgotPasswordFormProps = {
  turnstileSiteKey?: string | null;
};

export function ForgotPasswordForm({ turnstileSiteKey }: ForgotPasswordFormProps) {
  const [state, formAction] = useActionState<ForgotPasswordActionState, FormData>(requestPasswordResetAction, {});
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey) {
      return;
    }

    const renderTurnstile = () => {
      if (!window.turnstile || !containerRef.current) {
        return;
      }
      if (widgetIdRef.current) {
        window.turnstile.remove?.(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-turnstile-script]");
    if (existingScript) {
      if (window.turnstile) {
        renderTurnstile();
      } else {
        existingScript.addEventListener("load", renderTurnstile, { once: true });
      }
      return () => existingScript.removeEventListener("load", renderTurnstile);
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.addEventListener("load", renderTurnstile, { once: true });
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", renderTurnstile);
    };
  }, [turnstileSiteKey]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove?.(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!state?.success) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setTurnstileToken("");
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset?.(widgetIdRef.current);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [state?.success]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Terdaftar</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nama@contoh.com"
          autoComplete="email"
          required
        />
        {state?.fieldErrors?.email ? <p className="text-xs text-destructive">{state.fieldErrors.email}</p> : null}
      </div>
      {turnstileSiteKey ? (
        <div className="space-y-2">
          <div ref={containerRef} className="cf-turnstile" />
        </div>
      ) : process.env.NODE_ENV === "development" ? (
        <p className="text-xs text-muted-foreground">
          Verifikasi anti-robot belum dikonfigurasi. Tambahkan kunci Turnstile untuk mengaktifkan perlindungan ini.
        </p>
      ) : null}
      <input type="hidden" name="turnstileToken" value={turnstileToken} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      <SubmitButton disabled={Boolean(turnstileSiteKey) && !turnstileToken} />
    </form>
  );
}
