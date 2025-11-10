"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterDisclosureProps = {
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function FilterDisclosure({ children, defaultOpen = false }: FilterDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <div className="space-y-3 sm:space-y-0">
      <div className="sm:hidden">
        <Button
          type="button"
          variant={isOpen ? "secondary" : "outline"}
          onClick={toggle}
          className="flex w-full items-center justify-between gap-2"
        >
          <span>Filter</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen ? "rotate-180" : "rotate-0",
            )}
          />
        </Button>
      </div>
      <div
        className={cn(
          "sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-5",
          isOpen
            ? "grid gap-3 rounded-xl border border-border/60 bg-card/80 p-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
            : "hidden sm:grid",
        )}
      >
        {children}
      </div>
    </div>
  );
}
