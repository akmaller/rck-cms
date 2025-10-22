"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { confirmTwoFactorSetup, disableTwoFactor, startTwoFactorSetup } from "./actions";

type TwoFactorManagerProps = {
  email: string;
  twoFactorEnabled: boolean;
};

type SetupState = {
  secret: string;
  uri: string;
};

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export function TwoFactorManager({ email, twoFactorEnabled }: TwoFactorManagerProps) {
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [message, setMessage] = useState<MessageState>(null);
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await startTwoFactorSetup();
        setSetup(result);
        setMessage({
          type: "success",
          text: "Scan kode atau masukkan secret ke aplikasi autentikator Anda.",
        });
      } catch (error) {
        console.error(error);
        setMessage({ type: "error", text: "Gagal memulai setup 2FA." });
      }
    });
  };

  const handleConfirm = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await confirmTwoFactorSetup(token.trim());
      if (!result.success) {
        setMessage({ type: "error", text: result.message });
        return;
      }

      setEnabled(true);
      setSetup(null);
      setToken("");
      setMessage({ type: "success", text: result.message });
    });
  };

  const handleDisable = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await disableTwoFactor();
      if (!result.success) {
        setMessage({ type: "error", text: result.message ?? "Gagal menonaktifkan 2FA" });
        return;
      }

      setEnabled(false);
      setSetup(null);
      setToken("");
      setMessage({ type: "success", text: "2FA dinonaktifkan." });
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">Status saat ini</p>
        <p className="text-muted-foreground">
          {enabled ? "2FA aktif. Anda akan diminta kode OTP saat masuk." : "2FA belum diaktifkan."}
        </p>
        <p className="text-muted-foreground">
          Akun: <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            message.type === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {!enabled ? (
        <div className="space-y-4">
          <Button type="button" onClick={handleStart} disabled={isPending}>
            {isPending ? "Menyiapkan..." : "Mulai Setup 2FA"}
          </Button>

          {setup ? (
            <div className="space-y-3 rounded-md border border-dashed border-border p-4">
              <div className="text-sm">
                <p className="font-semibold text-foreground">Secret:</p>
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">{setup.secret}</code>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">URI (scan manual):</p>
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">{setup.uri}</code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Masukkan kode OTP dari aplikasi</Label>
                <Input
                  id="twoFactorCode"
                  name="twoFactorCode"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                />
                <Button type="button" onClick={handleConfirm} disabled={isPending || token.length < 6}>
                  Konfirmasi dan Aktifkan
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Simpan kode cadangan Anda dengan aman. Jika kehilangan perangkat autentikator, hubungi ADMIN untuk reset.
          </p>
          <Button type="button" variant="destructive" onClick={handleDisable} disabled={isPending}>
            {isPending ? "Memproses..." : "Nonaktifkan 2FA"}
          </Button>
        </div>
      )}
    </div>
  );
}
