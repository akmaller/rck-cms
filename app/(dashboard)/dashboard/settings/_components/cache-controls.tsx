"use client";

import { useTransition } from "react";

import { clearCacheAction } from "../actions";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

export function CacheControls() {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Manajemen Cache</h3>
        <p className="text-xs text-muted-foreground">
          Bersihkan cache manual setelah melakukan perubahan besar agar halaman publik segera diperbarui.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await clearCacheAction();
            if (!result.success) {
              notifyError(result.message ?? "Gagal membersihkan cache.");
              return;
            }
            notifySuccess(result.message ?? "Cache dibersihkan.");
          });
        }}
      >
        {isPending ? "Membersihkan..." : "Bersihkan Cache Sekarang"}
      </Button>
    </div>
  );
}
