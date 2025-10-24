"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { verifyTwoFactorAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TwoFactorFormProps = {
  token: string;
  redirectTo?: string;
  email?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memverifikasi..." : "Verifikasi"}
    </Button>
  );
}

export function TwoFactorForm({ token, redirectTo, email }: TwoFactorFormProps) {
  const [state, formAction] = useActionState(verifyTwoFactorAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Kode Autentikasi</Label>
        <Input
          id="code"
          name="code"
          placeholder="123456"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Masukkan kode 6 digit dari aplikasi autentikator Anda
          {email ? ` untuk ${email}` : ""}.
        </p>
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <SubmitButton />
    </form>
  );
}
