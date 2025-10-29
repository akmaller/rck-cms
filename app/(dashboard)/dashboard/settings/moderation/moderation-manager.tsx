"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { addForbiddenTermAction, deleteForbiddenTermAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/notifications/client";
import { MAX_FORBIDDEN_TERM_LENGTH } from "@/lib/moderation/filter-utils";
import { formatRelativeTime } from "@/lib/datetime/relative";

type ModerationTerm = {
  id: string;
  phrase: string;
  createdAt: string;
  createdByName: string | null;
};

type ModerationManagerProps = {
  initialTerms: ModerationTerm[];
};

export function ModerationManager({ initialTerms }: ModerationManagerProps) {
  const [terms, setTerms] = useState<ModerationTerm[]>(initialTerms);
  const [inputValue, setInputValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, startAddTransition] = useTransition();
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const totalTerms = terms.length;
  const emptyState = totalTerms === 0;

  const sortedTerms = useMemo(() => {
    return [...terms].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }, [terms]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="order-2 lg:order-1">
        <CardHeader>
          <CardTitle>Daftar Kata Terlarang</CardTitle>
          <CardDescription>
            Sistem akan memblokir pengiriman konten yang mengandung kata atau kalimat berikut ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emptyState ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 p-8 text-center">
              <p className="text-sm font-medium text-foreground">Belum ada kata terlarang.</p>
              <p className="text-xs text-muted-foreground">
                Tambahkan kata atau kalimat sensitif untuk mencegah konten yang tidak diinginkan.
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] divide-y divide-border overflow-auto rounded-md border border-border/60">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
                <span>Kata/Kalimat</span>
                <span className="hidden md:block">Dibuat Oleh</span>
                <span className="hidden md:block">Ditambahkan</span>
                <span className="text-right">Aksi</span>
              </div>
              <div>
                {sortedTerms.map((term) => (
                  <div
                    key={term.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_180px_140px_auto]"
                  >
                    <div className="font-medium text-foreground">{term.phrase}</div>
                    <div className="hidden text-xs text-muted-foreground md:block">
                      {term.createdByName ?? "Tidak diketahui"}
                    </div>
                    <div className="hidden text-xs text-muted-foreground md:block">
                      {formatRelativeTime(term.createdAt) || "-"}
                    </div>
                    <div className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive"
                        disabled={deletePendingId === term.id}
                        onClick={() => {
                          setDeletePendingId(term.id);
                          void (async () => {
                            const result = await deleteForbiddenTermAction(term.id);
                            if (!result.success) {
                              notifyError(result.message);
                            } else {
                              setTerms((prev) => prev.filter((item) => item.id !== term.id));
                              notifySuccess("Istilah berhasil dihapus.");
                            }
                            setDeletePendingId(null);
                          })();
                        }}
                      >
                        {deletePendingId === term.id ? "Menghapus..." : "Hapus"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between text-xs text-muted-foreground">
          <span>Total istilah: {totalTerms}</span>
          <span>Konten dengan istilah ini akan ditolak secara otomatis.</span>
        </CardFooter>
      </Card>

      <Card className="order-1 lg:order-2">
        <CardHeader>
          <CardTitle>Tambah Kata Terlarang</CardTitle>
          <CardDescription>
            Hindari penggunaan kata kasar, ujaran kebencian, atau kalimat sensitif di konten publik.
          </CardDescription>
        </CardHeader>
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setFormError(null);
            startAddTransition(async () => {
              const result = await addForbiddenTermAction(formData);
              if (!result.success) {
                setFormError(result.message);
                notifyError(result.message);
                return;
              }
              setTerms((prev) => [
                {
                  id: result.term.id,
                  phrase: result.term.phrase,
                  createdAt: result.term.createdAt,
                  createdByName: result.term.createdByName,
                },
                ...prev.filter((item) => item.id !== result.term.id),
              ]);
              setInputValue("");
              formRef.current?.reset();
              notifySuccess("Istilah terlarang berhasil ditambahkan.");
            });
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="phrase" className="text-sm font-medium text-foreground">
                Kata atau Kalimat
              </label>
              <Input
                id="phrase"
                name="phrase"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={`Contoh: kata kasar, kalimat sensitif (maks. ${MAX_FORBIDDEN_TERM_LENGTH} karakter)`}
                maxLength={MAX_FORBIDDEN_TERM_LENGTH}
                required
              />
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <p className="text-xs text-muted-foreground">
                Sistem akan memblokir konten yang mengandung string ini, tanpa membedakan huruf besar/kecil.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isAdding}>
              {isAdding ? "Menyimpan..." : "Tambah Istilah"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
