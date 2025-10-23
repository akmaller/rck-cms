"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start gap-2"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          void signOut({ redirectTo: "/login" });
        });
      }}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "Keluar..." : "Keluar"}
    </Button>
  );
}

