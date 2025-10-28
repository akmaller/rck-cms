"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordResetAction, type ForgotPasswordActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField } from "@/components/security/turnstile-field";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={pending || disabled}>
      {pending ? "Memproses..." : "Kirim Tautan Reset"}
    </Button>
  );
}

type ForgotPasswordFormProps = {
  turnstileSiteKey?: string | null;
};

export function ForgotPasswordForm({ turnstileSiteKey }: ForgotPasswordFormProps) {
  const [state, formAction] = useActionState<ForgotPasswordActionState, FormData>(requestPasswordResetAction, {});
  const [turnstileValid, setTurnstileValid] = useState(!turnstileSiteKey);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state?.success) {
      const timer = window.setTimeout(() => {
        setResetKey((key) => key + 1);
        setTurnstileValid(!turnstileSiteKey);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state?.success, turnstileSiteKey]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email Terdaftar</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="email@anda.com"
          autoComplete="email"
          className="h-11"
          required
        />
        {state?.fieldErrors?.email ? <p className="text-xs text-destructive">{state.fieldErrors.email}</p> : null}
      </div>
      <TurnstileField
        siteKey={turnstileSiteKey}
        resetKey={resetKey}
        onTokenChange={(token) => setTurnstileValid(Boolean(token) || !turnstileSiteKey)}
        tokenFieldName="turnstileToken"
      />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      <SubmitButton disabled={!turnstileValid} />
    </form>
  );
}
