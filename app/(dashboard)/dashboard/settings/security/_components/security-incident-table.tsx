"use client";

import { useMemo } from "react";

export type SecurityIncidentEntry = {
  id: string;
  category: string;
  description?: string | null;
  ip?: string | null;
  source?: string | null;
  metadata?: unknown;
  createdAt: string;
};

type SecurityIncidentTableProps = {
  entries: SecurityIncidentEntry[];
};

function formatMetadata(metadata: unknown) {
  if (!metadata) {
    return "-";
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export function SecurityIncidentTable({ entries }: SecurityIncidentTableProps) {
  const hasEntries = entries.length > 0;

  const formattedEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        createdLabel: new Date(entry.createdAt).toLocaleString("id-ID"),
        metadataLabel: formatMetadata(entry.metadata),
      })),
    [entries]
  );

  if (!hasEntries) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada aktivitas mencurigakan yang terekam dalam periode terbaru.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Kategori</th>
            <th className="px-4 py-3">Ringkasan</th>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">Sumber</th>
            <th className="px-4 py-3">Waktu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {formattedEntries.map((entry) => (
            <tr key={entry.id} className="bg-background align-top">
              <td className="px-4 py-3 font-medium text-foreground">{entry.category}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">
                <p className="font-medium text-foreground">{entry.description ?? "-"}</p>
                {entry.metadataLabel !== "-" ? (
                  <pre className="mt-2 max-h-32 overflow-y-auto rounded bg-muted/70 p-2 text-[11px] leading-tight text-muted-foreground">
                    {entry.metadataLabel}
                  </pre>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">
                {entry.ip ?? "-"}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">
                {entry.source ?? "-"}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground sm:text-sm">
                {entry.createdLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
