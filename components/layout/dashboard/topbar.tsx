"use client";

import { Menu, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DashboardTopbar() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <div className="relative hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:flex">
          <Search className="h-4 w-4" />
          <Input
            type="search"
            placeholder="Cari konten..."
            className="h-auto border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
        </div>
        {isSearchFocused && (
          <span className="text-xs text-muted-foreground">
            Tekan <kbd className="rounded border bg-muted px-1 text-[10px] text-muted-foreground">esc</kbd>{" "}
            untuk menutup
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          Simpan Draft
        </Button>
        <Button size="sm">Publikasikan</Button>
      </div>
    </header>
  );
}
