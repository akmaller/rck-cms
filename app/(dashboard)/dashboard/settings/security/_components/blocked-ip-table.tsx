"use client";

import { useTransition } from "react";

import { unblockIpAction } from "../actions";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

export type BlockedIpEntry = {
  id: string;
  ip: string;
  reason: string | null;
  blockedUntil: string | null;
  category: string | null;
  createdAt: string;
};

type BlockedIpTableProps = {
  entries: BlockedIpEntry[];
};

export function BlockedIpTable({ entries }: BlockedIpTableProps) {
  const [isPending, startTransition] = useTransition();

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada IP yang diblokir.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">IP Address</th>
            <th className="px-4 py-3">Alasan</th>
            <th className="px-4 py-3">Kategori</th>
            <th className="px-4 py-3">Berakhir</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {entries.map((entry) => {
            const blockedUntilLabel = entry.blockedUntil
              ? new Date(entry.blockedUntil).toLocaleString("id-ID")
              : "Tidak ditentukan";
            const reason = entry.reason ?? "Pembatasan otomatis";
            return (
              <tr key={entry.id} className="bg-background">
                <td className="px-4 py-3 font-mono text-xs sm:text-sm">{entry.ip}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">{reason}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">
                  {entry.category ?? "-"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">{blockedUntilLabel}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await unblockIpAction(entry.ip);
                        if (!result?.success) {
                          notifyError(result?.message ?? "Gagal melepas blokir.");
                          return;
                        }
                        notifySuccess("Blokir IP telah dilepas.");
                      });
                    }}
                  >
                    Lepas blokir
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
