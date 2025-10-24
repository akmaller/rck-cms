"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type FormEvent,
} from "react";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/lib/button-variants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  type: "ARTICLE" | "USER" | "PAGE";
  title: string;
  description?: string | null;
  href: string;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_DELAY = 250;

export function DashboardSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setResults([]);
    setError(null);
    setQuery("");
    setIsLoading(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    inputRef.current?.blur();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/dashboard/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Gagal memuat hasil pencarian.");
        }
        const json = (await response.json()) as { results: SearchResult[] };
        setResults(json.results ?? []);
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return;
        setError((fetchError as Error).message);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      controller.abort();
    };
  }, [query, isOpen]);

  const groupedResults = useMemo(() => {
    return results.reduce<Record<SearchResult["type"], SearchResult[]>>(
      (acc, result) => {
        acc[result.type] = acc[result.type] ? [...acc[result.type], result] : [result];
        return acc;
      },
      { ARTICLE: [], USER: [], PAGE: [] }
    );
  }, [results]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative ml-auto hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:flex"
      >
        <Search className="h-4 w-4" />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Cari konten..."
          className="h-auto border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        />
      </form>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-16">
          <div
            className="absolute inset-0"
            onClick={() => close()}
            aria-hidden
          />
          <div className="relative z-10 flex w-full max-w-3xl flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Hasil Pencarian</h2>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "px-2")}
                onClick={() => close()}
              >
                Tutup
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ketik minimal {MIN_QUERY_LENGTH} karakter. Tekan <kbd className="rounded border bg-muted px-1 text-[10px] text-muted-foreground">esc</kbd> untuk menutup.
            </p>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border/60 bg-muted/10">
              {error ? (
                <p className="px-4 py-6 text-sm text-destructive">{error}</p>
              ) : isLoading ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Memuat hasil...</p>
              ) : query.trim().length < MIN_QUERY_LENGTH ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Ketik minimal {MIN_QUERY_LENGTH} karakter untuk mencari.
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Tidak ada hasil untuk “{query}”.</p>
              ) : (
                <div className="divide-y divide-border/80">
                  {(["USER", "ARTICLE", "PAGE"] as SearchResult["type"][])
                    .filter((type) => groupedResults[type]?.length)
                    .map((type) => (
                      <div key={type} className="space-y-1">
                        <p className="px-4 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {type === "USER" ? "Pengguna" : type === "ARTICLE" ? "Artikel" : "Halaman"}
                        </p>
                        {groupedResults[type]?.map((result) => (
                          <Link
                            key={result.id}
                            href={result.href}
                            className="flex flex-col gap-1 px-4 py-3 text-sm transition hover:bg-accent"
                            onClick={() => close()}
                          >
                            <span className="flex items-center gap-2 font-medium text-foreground">
                              {result.title}
                              <Badge variant="secondary">{type.toLowerCase()}</Badge>
                            </span>
                            {result.description ? (
                              <span className="text-xs text-muted-foreground">{result.description}</span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
