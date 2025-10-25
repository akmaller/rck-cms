"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { importBackupAction } from "../actions";
import { Button } from "@/components/ui/button";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications/client";

const SECTION_OPTIONS = [
  { value: "config", label: "Konfigurasi" },
  { value: "articles", label: "Artikel" },
  { value: "pages", label: "Halaman" },
  { value: "users", label: "Pengguna" },
  { value: "media", label: "Media" },
  { value: "audits", label: "Log Aktivitas" },
] as const;

export function BackupControls() {
  const [isImporting, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(SECTION_OPTIONS.map((option) => option.value))
  );
  const [format, setFormat] = useState<"json" | "sql">("json");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleSelection = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const exportUrl = useMemo(() => {
    const values = Array.from(selected);
    if (values.length === 0) {
      return null;
    }
    const params = new URLSearchParams();
    params.set("types", values.join(","));
    params.set("format", format);
    return `/api/dashboard/backup/export?${params.toString()}`;
  }, [selected, format]);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Backup Database</h3>
        <p className="text-xs text-muted-foreground">
          Pilih data yang ingin diekspor. Sistem akan menyertakan seluruh isi tabel termasuk konten dan metadata
          terkait.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SECTION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm transition hover:border-primary/50"
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selected.has(option.value)}
              onChange={() => toggleSelection(option.value)}
            />
            <span className="text-sm text-foreground">{option.label}</span>
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Format file</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="backup-format"
              value="json"
              checked={format === "json"}
              onChange={() => setFormat("json")}
            />
            <span>JSON (.json)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="backup-format"
              value="sql"
              checked={format === "sql"}
              onChange={() => setFormat("sql")}
            />
            <span>SQL (.sql)</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!exportUrl}
          onClick={() => {
            if (!exportUrl) {
              notifyError("Pilih minimal satu kategori data untuk di-backup.");
              return;
            }
            notifyInfo(`Menyiapkan ekspor (${format.toUpperCase()})...`);
            window.open(exportUrl, "_blank", "noopener,noreferrer");
          }}
        >
          Unduh Backup ({format.toUpperCase()})
        </Button>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const file = fileInputRef.current?.files?.[0];
            if (!file) {
              notifyError("Pilih file backup terlebih dahulu.");
              return;
            }
            const formData = new FormData();
            formData.append("backupFile", file);
            startTransition(async () => {
              const result = await importBackupAction(formData);
              if (!result.success) {
                notifyError(result.message ?? "Gagal mengimpor backup.");
                return;
              }
              notifySuccess(result.message ?? "Backup berhasil diimpor.");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            });
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            name="backupFile"
            accept=".json,.sql,application/json,application/sql,text/plain"
            className="block w-60 text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-accent hover:file:text-accent-foreground"
          />
          <Button type="submit" disabled={isImporting}>
            {isImporting ? "Mengimpor..." : "Impor Backup"}
          </Button>
        </form>
      </div>
      <p className="text-xs text-muted-foreground">
        Ekspor menyertakan seluruh konten tabel yang dipilih. Impor kini dapat memulihkan seluruh data dari file JSON
        atau SQL hasil ekspor sebelumnya.
      </p>
    </div>
  );
}
