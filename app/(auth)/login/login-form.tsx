"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField } from "@/components/security/turnstile-field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={pending || disabled}>
      {pending ? "Memproses..." : "Masuk"}
    </Button>
  );
}

type LoginFormProps = {
  callbackUrl?: string;
  turnstileSiteKey?: string | null;
  googleAuthEnabled: boolean;
};

export function LoginForm({ callbackUrl, turnstileSiteKey, googleAuthEnabled }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, {});
  const [turnstileValid, setTurnstileValid] = useState(!turnstileSiteKey);
  const [resetKey, setResetKey] = useState(0);

  const handleTokenChange = useCallback(
    (token: string) => {
      if (!turnstileSiteKey) {
        setTurnstileValid(true);
        return;
      }
      setTurnstileValid(Boolean(token));
    },
    [turnstileSiteKey]
  );

  useEffect(() => {
    if (state?.error) {
      const timer = window.setTimeout(() => {
        setTurnstileValid(!turnstileSiteKey);
        setResetKey((key) => key + 1);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state?.error, turnstileSiteKey]);

  const disableSubmit = turnstileSiteKey ? !turnstileValid : false;

  return (
    <div className="space-y-5">
      {googleAuthEnabled ? (
        <>
          <GoogleSignInButton callbackUrl={callbackUrl} label="Masuk dengan Google" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-dashed border-slate-200" aria-hidden />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs uppercase tracking-wide text-slate-400">
                atau masuk dengan email
              </span>
            </div>
          </div>
        </>
      ) : null}
      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="email@anda.com"
            autoComplete="email"
            className="h-11"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-11"
          />
        </div>
        <TurnstileField
          siteKey={turnstileSiteKey}
          onTokenChange={handleTokenChange}
          tokenFieldName="turnstileToken"
          resetKey={resetKey}
        />
        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <input type="hidden" name="redirectTo" value={callbackUrl ?? ""} />
        <SubmitButton disabled={disableSubmit} />
      </form>
    </div>
  );
}
