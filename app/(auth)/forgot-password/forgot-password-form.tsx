"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordResetAction, type ForgotPasswordActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memproses..." : "Kirim Tautan Reset"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ForgotPasswordActionState, FormData>(requestPasswordResetAction, {});

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
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      <SubmitButton />
    </form>
  );
}
