"use client";

import { useEffect, useState, useTransition } from "react";

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

type QrState = {
  status: "idle" | "loading" | "ready" | "error";
  dataUrl: string | null;
};

export function TwoFactorManager({ email, twoFactorEnabled }: TwoFactorManagerProps) {
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [message, setMessage] = useState<MessageState>(null);
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();
  const [qrCode, setQrCode] = useState<QrState>({ status: "idle", dataUrl: null });

  const resetSetupState = () => {
    setSetup(null);
    setToken("");
    setQrCode({ status: "idle", dataUrl: null });
  };

  const handleStart = () => {
    setMessage(null);
    setQrCode({ status: "loading", dataUrl: null });
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
        setQrCode({ status: "idle", dataUrl: null });
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
      resetSetupState();
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
      resetSetupState();
      setMessage({ type: "success", text: "2FA dinonaktifkan." });
    });
  };

  useEffect(() => {
    let isMounted = true;

    if (!setup?.uri) {
      setQrCode({ status: "idle", dataUrl: null });
      return () => {
        isMounted = false;
      };
    }

    setQrCode({ status: "loading", dataUrl: null });

    import("qrcode")
      .then(({ toDataURL }) => toDataURL(setup.uri, { width: 220, margin: 1 }))
      .then((dataUrl) => {
        if (isMounted) {
          setQrCode({ status: "ready", dataUrl });
        }
      })
      .catch((error) => {
        console.error("Failed to generate QR code", error);
        if (isMounted) {
          setQrCode({ status: "error", dataUrl: null });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [setup?.uri]);

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
            message.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
              : "border-destructive/40 bg-destructive/10 text-destructive"
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
            <div className="space-y-4 rounded-md border border-dashed border-border p-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-col items-center gap-2">
                  {qrCode.status === "ready" && qrCode.dataUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCode.dataUrl}
                        alt="Kode QR 2FA"
                        className="h-48 w-48 rounded-md border border-border bg-white p-3 shadow-sm"
                      />
                    </>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-center text-xs text-muted-foreground">
                      {qrCode.status === "error"
                        ? "Tidak dapat membuat QR code. Gunakan secret di bawah ini."
                        : "QR code sedang disiapkan..."}
                    </div>
                  )}
                  <p className="max-w-[220px] text-center text-xs text-muted-foreground">
                    Pindai kode menggunakan aplikasi authenticator (Google Authenticator, 1Password, dll).
                  </p>
                </div>
                <div className="flex-1 space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">Secret manual:</p>
                    <code className="break-all rounded bg-muted px-2 py-1 text-xs">{setup.secret}</code>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">URI Otentikasi:</p>
                    <code className="break-all rounded bg-muted px-2 py-1 text-xs">{setup.uri}</code>
                  </div>
                </div>
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
