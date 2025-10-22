import Link from "next/link";

import { publicNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold">{siteConfig.name}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {publicNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Masuk</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
