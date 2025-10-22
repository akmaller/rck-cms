import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background/80">
      <div className="container flex flex-col gap-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-foreground">{siteConfig.name}</span>
          <p className="max-w-md">{siteConfig.description}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4">
          {Object.entries(siteConfig.links).map(([key, value]) => {
            if (!value) return null;
            return (
              <Link
                key={key}
                href={value}
                className="transition-colors hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                {key}
              </Link>
            );
          })}
        </nav>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {siteConfig.name}. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
