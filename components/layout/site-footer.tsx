import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Twitter, Youtube, type LucideIcon } from "lucide-react";

import { getSiteConfig } from "@/lib/site-config/server";
import { getMenuTree } from "@/lib/menu/server";
import { resolveMenuHref } from "@/lib/menu/utils";

export async function SiteFooter() {
  const [config, footerMenu] = await Promise.all([getSiteConfig(), getMenuTree("footer")]);
  const menuSections = footerMenu
    .filter((item) => item.children.length > 0)
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: resolveMenuHref(item.slug, item.url),
      links: item.children.map((child) => ({
        id: child.id,
        title: child.title,
        href: resolveMenuHref(child.slug, child.url),
      })),
    }));

  const directLinks = footerMenu
    .filter((item) => item.children.length === 0)
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: resolveMenuHref(item.slug, item.url),
    }));
  const directLinkLimit = Math.min(directLinks.length, 15);
  const directLinkGroups: Array<typeof directLinks> = [];
  let sliceSize = 5;
  if (directLinkLimit <= 5) {
    sliceSize = directLinkLimit;
  }
  for (let index = 0; index < directLinkLimit; index += sliceSize) {
    directLinkGroups.push(directLinks.slice(index, index + sliceSize));
  }

  const socialEntries = [
    { key: "facebook", label: "Facebook", href: config.links.facebook, icon: Facebook },
    { key: "instagram", label: "Instagram", href: config.links.instagram, icon: Instagram },
    { key: "twitter", label: "Twitter", href: config.links.twitter, icon: Twitter },
    { key: "youtube", label: "YouTube", href: config.links.youtube, icon: Youtube },
  ].filter(
    (entry): entry is { key: string; label: string; href: string; icon: LucideIcon } =>
      Boolean(entry.href)
  );

  return (
    <footer className="border-t border-border bg-background/90">
      <div className="container space-y-10 py-12 text-sm text-muted-foreground">
        <div className="grid gap-10 md:grid-cols-[40%_60%]">
          <div className="flex flex-col gap-6 md:pr-8">
            <Link href="/" className="flex items-center gap-4 text-foreground">
              {config.logoUrl ? (
                <span className="flex h-12 max-w-[14rem] items-center">
                  <Image
                    src={config.logoUrl}
                    alt={config.name}
                    width={220}
                    height={48}
                    className="max-h-full object-contain"
                    style={{ width: "auto", height: "auto" }}
                    priority
                  />
                </span>
              ) : (
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">{config.name}</span>
                  {config.tagline ? (
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {config.tagline}
                    </span>
                  ) : null}
                </div>
              )}
            </Link>
            {socialEntries.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ikuti Kami
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {socialEntries.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <a
                        key={entry.key}
                        href={entry.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition hover:border-primary/60 hover:text-primary"
                        aria-label={entry.label}
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          {menuSections.length > 0 || directLinkGroups.length > 0 ? (
            <nav className="grid gap-8 sm:grid-cols-2 md:grid-cols-1 md:gap-10" aria-label="Navigasi footer">
              {menuSections.map((section) => (
                <div key={section.id} className="space-y-3">
                  {section.href === "#" ? (
                    <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
                      {section.title}
                    </p>
                  ) : (
                    <Link
                      href={section.href}
                      className="text-sm font-semibold uppercase tracking-wide text-foreground transition hover:text-primary"
                    >
                      {section.title}
                    </Link>
                  )}
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.id}>
                        {link.href === "#" ? (
                          <span className="text-muted-foreground">{link.title}</span>
                        ) : (
                          <Link
                            href={link.href}
                            className="transition-colors hover:text-foreground"
                          >
                            {link.title}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {directLinkGroups.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    Menu
                  </p>
                  <div
                    className={
                      directLinkGroups.length > 1
                        ? "grid gap-4 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3"
                        : "grid gap-4"
                    }
                  >
                    {directLinkGroups.map((group, groupIndex) => (
                      <ul key={`direct-links-${groupIndex}`} className="space-y-2">
                        {group.map((link) => (
                          <li key={link.id}>
                            {link.href === "#" ? (
                              <span className="text-muted-foreground">{link.title}</span>
                            ) : (
                              <Link
                                href={link.href}
                                className="transition-colors hover:text-foreground"
                              >
                                {link.title}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                </div>
              ) : null}
            </nav>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {config.name}. Hak cipta dilindungi.
          </p>
          {config.contactEmail ? (
            <a
              href={`mailto:${config.contactEmail}`}
              className="transition-colors hover:text-foreground"
            >
              {config.contactEmail}
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
