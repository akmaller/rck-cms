"use client";

import { useTransition } from "react";

import { updateSecurityPolicyAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

type SecurityPolicyFormProps = {
  defaults: {
    loginMaxAttempts: number;
    loginWindowMinutes: number;
    pageMaxVisits: number;
    pageWindowMinutes: number;
    apiMaxRequests: number;
    apiWindowMinutes: number;
    blockDurationMinutes: number;
  };
};

export function SecurityPolicyForm({ defaults }: SecurityPolicyFormProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateSecurityPolicyAction(form);
          if (!result?.success) {
            notifyError(result?.message ?? "Gagal memperbarui kebijakan keamanan.");
            return;
          }
          notifySuccess(result.message ?? "Kebijakan keamanan diperbarui.");
        });
      }}
    >
      <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
        <legend className="text-sm font-semibold text-foreground">Percobaan Login</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="loginMaxAttempts">Maksimal percobaan</Label>
            <Input
              id="loginMaxAttempts"
              name="loginMaxAttempts"
              type="number"
              min={1}
              defaultValue={defaults.loginMaxAttempts}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="loginWindowMinutes">Jangka waktu (menit)</Label>
            <Input
              id="loginWindowMinutes"
              name="loginWindowMinutes"
              type="number"
              min={1}
              defaultValue={defaults.loginWindowMinutes}
              required
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
        <legend className="text-sm font-semibold text-foreground">Kunjungan Halaman</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="pageMaxVisits">Maksimal kunjungan per halaman</Label>
            <Input
              id="pageMaxVisits"
              name="pageMaxVisits"
              type="number"
              min={1}
              defaultValue={defaults.pageMaxVisits}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pageWindowMinutes">Jangka waktu (menit)</Label>
            <Input
              id="pageWindowMinutes"
              name="pageWindowMinutes"
              type="number"
              min={1}
              defaultValue={defaults.pageWindowMinutes}
              required
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
        <legend className="text-sm font-semibold text-foreground">Permintaan API</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="apiMaxRequests">Maksimal permintaan</Label>
            <Input
              id="apiMaxRequests"
              name="apiMaxRequests"
              type="number"
              min={1}
              defaultValue={defaults.apiMaxRequests}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="apiWindowMinutes">Jangka waktu (menit)</Label>
            <Input
              id="apiWindowMinutes"
              name="apiWindowMinutes"
              type="number"
              min={1}
              defaultValue={defaults.apiWindowMinutes}
              required
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-4">
        <Label htmlFor="blockDurationMinutes">Durasi blokir IP (menit)</Label>
        <Input
          id="blockDurationMinutes"
          name="blockDurationMinutes"
          type="number"
          min={1}
          defaultValue={defaults.blockDurationMinutes}
          required
        />
        <p className="text-xs text-muted-foreground">
          IP yang melampaui batas akan diblokir sementara selama durasi ini.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan Kebijakan"}
        </Button>
      </div>
    </form>
  );
}
