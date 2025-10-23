"use client";

import { Menu, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useDashboardHeader } from "./dashboard-header-context";

export function DashboardTopbar() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const {
    state: { heading, description },
  } = useDashboardHeader();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <div className="flex flex-col">
          {heading ? <h1 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{heading}</h1> : null}
          {description ? (
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="relative ml-auto hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:flex">
        <Search className="h-4 w-4" />
        <Input
          type="search"
          placeholder="Cari konten..."
          className="h-auto border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
      </div>
      {isSearchFocused ? (
        <span className="ml-3 hidden text-xs text-muted-foreground md:inline">
          Tekan <kbd className="rounded border bg-muted px-1 text-[10px] text-muted-foreground">esc</kbd> untuk menutup
        </span>
      ) : null}
    </header>
  );
}
