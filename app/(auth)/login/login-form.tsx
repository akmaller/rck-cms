"use client";

import { useFormState, useFormStatus } from "react-dom";

import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memproses..." : "Masuk"}
    </Button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useFormState(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="admin@roemahcita.local"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="twoFactorCode">
          Kode 2FA <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <Input
          id="twoFactorCode"
          name="twoFactorCode"
          placeholder="123456"
          inputMode="numeric"
          pattern="[0-9]{6}"
        />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <input type="hidden" name="redirectTo" value={callbackUrl ?? ""} />
      <SubmitButton />
    </form>
  );
}
