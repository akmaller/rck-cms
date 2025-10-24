import Link from "next/link";

import { getSiteConfig } from "@/lib/site-config/server";
import { getMenuTree } from "@/lib/menu/server";

function resolveHref(slug: string | null, url: string | null) {
  return url ? url : slug ? `/${slug}` : "#";
}

export async function SiteFooter() {
  const [config, footerMenu] = await Promise.all([getSiteConfig(), getMenuTree("footer")]);
  return (
    <footer className="border-t border-border bg-background/80">
      <div className="container flex flex-col gap-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-foreground">{config.name}</span>
          <p className="max-w-md">{config.description}</p>
        </div>
        <nav className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {footerMenu.length > 0
            ? footerMenu.map((item) => {
                const href = resolveHref(item.slug, item.url);
                return (
                  <div key={item.id} className="space-y-2">
                    {item.children.length === 0 ? (
                      href === "#" ? (
                        <span className="text-xs font-semibold uppercase text-foreground">
                          {item.title}
                        </span>
                      ) : (
                        <Link
                          href={href}
                          className="text-xs font-semibold uppercase text-foreground transition-colors hover:text-primary"
                        >
                          {item.title}
                        </Link>
                      )
                    ) : (
                      <>
                        <p className="text-xs font-semibold uppercase text-foreground">
                          {item.title}
                        </p>
                        <ul className="space-y-1">
                          {item.children.map((child) => {
                            const childHref = resolveHref(child.slug, child.url);
                            return (
                              <li key={child.id}>
                                {childHref === "#" ? (
                                  <span className="transition-colors hover:text-foreground">
                                    {child.title}
                                  </span>
                                ) : (
                                  <Link
                                    href={childHref}
                                    className="transition-colors hover:text-foreground"
                                  >
                                    {child.title}
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })
            : null}
        </nav>
        <div className="flex flex-wrap items-center gap-4">
          {Object.entries(config.links).map(([key, value]) => {
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
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {config.name}. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
