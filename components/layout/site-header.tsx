import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Suspense } from "react";

import { getSiteConfig } from "@/lib/site-config/server";
import { getMenuTree } from "@/lib/menu/server";
import { resolveMenuHref } from "@/lib/menu/utils";
import { PublicAuthActions } from "@/app/(public)/(components)/auth-actions";
import { MobileNavigation } from "./site-header-mobile";
import { ResponsiveLogoImage } from "./site-logo";

export async function SiteHeader() {
  const [config, mainMenu] = await Promise.all([getSiteConfig(), getMenuTree("main")]);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          {config.logoUrl ? (
            <ResponsiveLogoImage
              src={config.logoUrl}
              alt={config.name}
              maxHeight={48}
              maxWidth={240}
              priority
            />
          ) : null}
          {!config.logoUrl ? (
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold">{config.name}</span>
              {config.tagline ? (
                <span className="text-xs text-muted-foreground">{config.tagline}</span>
              ) : null}
            </div>
          ) : null}
        </Link>
        <nav
          className="hidden items-center gap-2 text-sm font-medium md:flex"
          aria-label="Navigasi utama"
        >
          {mainMenu.map((item) => {
            const href = resolveMenuHref(item.slug, item.url);
            const disabled = href === "#";
            if (item.children.length > 0) {
              return (
                <div key={item.id} className="relative group">
                  {disabled ? (
                    <span className="inline-flex items-center rounded-full px-3 py-2 text-muted-foreground">
                      {item.title}
                    </span>
                  ) : (
                    <Link
                      href={href}
                      className="inline-flex items-center rounded-full px-3 py-2 text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {item.title}
                    </Link>
                  )}
                  <div className="pointer-events-none absolute left-0 top-full z-40 w-56 -translate-y-2 rounded-xl border border-border/70 bg-card/95 p-2 opacity-0 shadow-lg ring-1 ring-primary/10 transition duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 before:absolute before:-top-3 before:left-0 before:h-3 before:w-full before:content-['']">
                    <ul className="space-y-1 py-1 text-sm">
                      {item.children.map((child) => {
                        const childHref = resolveMenuHref(child.slug, child.url);
                        return (
                          <li key={child.id}>
                            <Link
                              href={childHref}
                              className="block rounded-md px-3 py-2 text-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              {child.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            }

              return disabled ? (
              <span
                key={item.id}
                className="inline-flex items-center rounded-full px-3 py-2 text-muted-foreground"
              >
                {item.title}
              </span>
            ) : (
              <Link
                key={item.id}
                href={href}
                className="inline-flex items-center rounded-full px-3 py-2 text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Cari artikel"
          >
            <Search className="h-4 w-4" />
            <span>Cari</span>
          </Link>
          <PublicAuthActions />
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-primary/60 hover:text-primary"
            data-sidebar-trigger
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      <Suspense fallback={null}>
        <MobileNavigation siteConfig={config} mainMenu={mainMenu} />
      </Suspense>
    </header>
  );
}
