"use client";

import { Moon, Sun } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/notifications/client";
import { setThemePreference } from "@/app/(dashboard)/dashboard/theme/actions";

import { useDashboardTheme } from "./dashboard-theme-context";

export function DashboardThemeToggle() {
  const { theme, setTheme } = useDashboardTheme();
  const [isPending, startTransition] = useTransition();

  const isDark = theme === "DARK";

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const nextTheme = isDark ? "LIGHT" : "DARK";
            const result = await setThemePreference(nextTheme);
            if (!result.success) {
              notifyError(result.message ?? "Gagal memperbarui tema");
              return;
            }
            setTheme(nextTheme);
          });
        }}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isPending ? "Mengatur..." : isDark ? "Mode Terang" : "Mode Gelap"}
      </Button>
    </div>
  );
}
