import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { getSiteConfig } from "@/lib/site-config/server";
import { getMenuTree } from "@/lib/menu/server";

function resolveHref(slug: string | null, url: string | null) {
  return url ? url : slug ? `/${slug}` : "#";
}

export async function SiteHeader() {
  const [config, mainMenu] = await Promise.all([getSiteConfig(), getMenuTree("main")]);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {config.logoUrl ? (
            <Image src={config.logoUrl} alt={config.name} width={32} height={32} className="h-8 w-8 rounded" />
          ) : null}
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold">{config.name}</span>
            {config.tagline ? (
              <span className="text-xs text-muted-foreground">{config.tagline}</span>
            ) : null}
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {mainMenu.map((item) => {
            const href = resolveHref(item.slug, item.url);
            const disabled = href === "#";
            if (item.children.length > 0) {
              return (
                <div key={item.id} className="relative group">
                  {disabled ? (
                    <span className="text-muted-foreground">{item.title}</span>
                  ) : (
                    <Link
                      href={href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  )}
                  <div className="invisible absolute left-0 top-full z-40 mt-2 w-40 rounded-md border border-border bg-card shadow-lg opacity-0 transition group-hover:visible group-hover:opacity-100">
                    <ul className="py-2 text-sm">
                      {item.children.map((child) => {
                        const childHref = resolveHref(child.slug, child.url);
                        return (
                          <li key={child.id}>
                            <Link
                              href={childHref}
                              className="block px-3 py-1 text-muted-foreground transition hover:text-foreground"
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
              <span key={item.id} className="text-muted-foreground">
                {item.title}
              </span>
            ) : (
              <Link
                key={item.id}
                href={href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.title}
              </Link>
            );
          })}
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
