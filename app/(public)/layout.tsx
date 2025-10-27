import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <div className="container px-2 sm:px-4 lg:px-6 py-6 sm:py-8 lg:py-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
