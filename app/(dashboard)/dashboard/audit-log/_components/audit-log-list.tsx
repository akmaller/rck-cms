"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type AuditLogListProps = {
  logs: Array<{
    id: string;
    createdAt: string;
    action: string;
    entity: string;
    entityId: string;
    metadata: unknown;
    userName: string;
    userEmail: string | null;
  }>;
  total: number;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogList({ logs, total }: AuditLogListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLog = useMemo(() => logs.find((log) => log.id === selectedId) ?? null, [logs, selectedId]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Sistem</CardTitle>
          <CardDescription>
            {logs.length === 0
              ? "Tidak ada log pada rentang ini."
              : `Menampilkan ${logs.length} dari total ${total.toLocaleString("id-ID")} log.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {logs.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Tidak ada data log pada rentang ini.
            </p>
          ) : (
            logs.map((log) => (
              <button
                key={log.id}
                type="button"
                className="flex w-full flex-col gap-2 py-3 text-left transition hover:bg-accent/40"
                onClick={() => setSelectedId(log.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateTime(log.createdAt)}</span>
                    <Badge variant="secondary">{log.action}</Badge>
                  </div>
                  <span className="text-xs font-medium text-foreground">{log.userName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {log.entity} • #{log.entityId}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selectedLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Detail Log</h2>
                <p className="text-xs text-muted-foreground">{formatDateTime(selectedLog.createdAt)}</p>
              </div>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "px-2")}
                onClick={() => setSelectedId(null)}
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Aksi</p>
                <p className="font-medium text-foreground">{selectedLog.action}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Entitas</p>
                <p className="font-medium text-foreground">
                  {selectedLog.entity} • #{selectedLog.entityId}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Pengguna</p>
                <p className="font-medium text-foreground">{selectedLog.userName}</p>
                {selectedLog.userEmail ? (
                  <p className="text-xs text-muted-foreground">{selectedLog.userEmail}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Metadata</p>
                <pre className="max-h-56 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
                  {JSON.stringify(selectedLog.metadata ?? "-", null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
