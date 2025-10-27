"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { registerAction, type RegisterActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField } from "@/components/security/turnstile-field";

type RegisterFormProps = {
  privacyPolicyUrl?: string | null;
  turnstileSiteKey?: string | null;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Memproses..." : "Daftar"}
    </Button>
  );
}

export function RegisterForm({ privacyPolicyUrl, turnstileSiteKey }: RegisterFormProps) {
  const [state, formAction] = useActionState<RegisterActionState, FormData>(registerAction, {});
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
    if (state?.error || state?.success) {
      const timer = window.setTimeout(() => {
        setTurnstileValid(!turnstileSiteKey);
        setResetKey((key) => key + 1);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state?.error, state?.success, turnstileSiteKey]);

  const disableSubmit = turnstileSiteKey ? !turnstileValid : false;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama Lengkap</Label>
        <Input id="name" name="name" type="text" placeholder="Nama lengkap Anda" required />
        {state?.fieldErrors?.name ? <p className="text-xs text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="nama@contoh.com" autoComplete="email" required />
        {state?.fieldErrors?.email ? <p className="text-xs text-destructive">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        {state?.fieldErrors?.password ? <p className="text-xs text-destructive">{state.fieldErrors.password}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        {state?.fieldErrors?.confirmPassword ? (
          <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>
      {privacyPolicyUrl ? (
        <p className="text-xs text-muted-foreground">
          Dengan mendaftar, Anda menyetujui{" "}
          <Link href={privacyPolicyUrl} className="font-medium text-primary hover:underline">
            Kebijakan &amp; Privasi
          </Link>{" "}
          kami.
        </p>
      ) : null}
      <TurnstileField
        siteKey={turnstileSiteKey}
        onTokenChange={handleTokenChange}
        tokenFieldName="turnstileToken"
        resetKey={resetKey}
      />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      <SubmitButton disabled={disableSubmit} />
    </form>
  );
}
