"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentType,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Facebook, Instagram, Search, Twitter, Youtube, X } from "lucide-react";
import { createPortal } from "react-dom";

import { PublicAuthActions } from "@/app/(public)/(components)/auth-actions";
import type { ResolvedSiteConfig } from "@/lib/site-config/types";
import { resolveMenuHref, type MenuNode } from "@/lib/menu/utils";
import { cn } from "@/lib/utils";

type MobileNavigationProps = {
  siteConfig: ResolvedSiteConfig;
  mainMenu: MenuNode[];
};

export function MobileNavigation({ siteConfig, mainMenu }: MobileNavigationProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, startCloseTransition] = useTransition();
  const isOpenRef = useRef(isOpen);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const closeMenu = useCallback(() => {
    if (!isOpenRef.current) {
      return;
    }
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && asideRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sidebar-trigger]")
    );
    const handleOpen = () => {
      isOpenRef.current = true;
      setIsOpen(true);
    };
    triggers.forEach((trigger) => trigger.addEventListener("click", handleOpen));

    return () => {
      triggers.forEach((trigger) => trigger.removeEventListener("click", handleOpen));
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeMenu]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.setProperty("overflow", "hidden");
    } else {
      document.body.style.removeProperty("overflow");
    }
    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [isOpen]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpenRef.current) {
      return;
    }
    startCloseTransition(() => {
      closeMenu();
    });
  }, [pathname, startCloseTransition, closeMenu]);

  const menuItems = useMemo(() => mainMenu, [mainMenu]);
  const socialLinks = useMemo(() => {
    const entries: Array<{
      key: string;
      href: string;
      label: string;
      icon: ComponentType<{ className?: string }>;
    }> = [];

    const links = siteConfig.links ?? {};
    if (links.facebook) {
      entries.push({ key: "facebook", href: links.facebook, label: "Facebook", icon: Facebook });
    }
    if (links.instagram) {
      entries.push({ key: "instagram", href: links.instagram, label: "Instagram", icon: Instagram });
    }
    if (links.twitter) {
      entries.push({ key: "twitter", href: links.twitter, label: "Twitter", icon: Twitter });
    }
    if (links.youtube) {
      entries.push({ key: "youtube", href: links.youtube, label: "YouTube", icon: Youtube });
    }
    return entries;
  }, [siteConfig.links]);

  if (!mounted) {
    return null;
  }

  const portalTarget = document.body;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-[2000] backdrop-blur-xl transition-opacity md:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMenu}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[2100] opacity-90 md:hidden overflow-hidden transition-[width] duration-200 ease-out",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        style={{ width: isOpen ? "min(85vw, 18rem)" : "0px" }}
      >
        <aside
          ref={asideRef}
          className={cn(
            "flex min-h-screen w-[18rem] max-w-[85vw] flex-col border-l border-border bg-white/90 shadow-[0_10px_40px_rgba(15,23,42,0.22)] backdrop-blur-xl transition-transform duration-200 ease-out will-change-transform",
            isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          )}
          aria-hidden={!isOpen}
          aria-label="Navigasi seluler"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              {siteConfig.logoUrl ? (
                <span className="flex h-10 max-w-[12rem] items-center">
                  <Image
                    src={siteConfig.logoUrl}
                    alt={siteConfig.name}
                    width={200}
                    height={80}
                    className="h-full w-auto object-contain"
                    priority={false}
                  />
                </span>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">{siteConfig.name}</p>
                  {siteConfig.tagline ? (
                    <p className="text-xs text-muted-foreground">{siteConfig.tagline}</p>
                  ) : null}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={closeMenu}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/60 hover:text-primary"
              aria-label="Tutup menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-border px-4 py-3">
            <div className="flex w-full flex-col gap-2">
              <Link
                href="/search"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={closeMenu}
              >
                <Search className="h-4 w-4" />
                <span>Cari Artikel</span>
              </Link>
              <PublicAuthActions />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4 text-sm">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const href = resolveMenuHref(item.slug, item.url);
                const isActive =
                  href !== "#" &&
                  (href === "/"
                    ? pathname === href
                    : pathname?.startsWith(href.replace(/\/$/, "")));

                return (
                  <li key={item.id}>
                    {href === "#" ? (
                      <span className="block rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                        {item.title}
                      </span>
                    ) : (
                      <Link
                        href={href}
                        className={cn(
                          "block rounded-lg px-3 py-2 font-semibold transition hover:bg-primary/10 hover:text-primary",
                          isActive ? "bg-primary/10 text-primary" : "text-foreground"
                        )}
                        onClick={closeMenu}
                      >
                        {item.title}
                      </Link>
                    )}
                    {item.children.length > 0 ? (
                      <ul className="mt-2 space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground">
                        {item.children.map((child) => {
                          const childHref = resolveMenuHref(child.slug, child.url);
                          const isChildActive =
                            childHref !== "#" &&
                            (childHref === "/"
                              ? pathname === childHref
                              : pathname?.startsWith(childHref.replace(/\/$/, "")));
                          return (
                            <li key={child.id}>
                              {childHref === "#" ? (
                                <span className="block rounded px-2 py-1 text-muted-foreground">
                                  {child.title}
                                </span>
                              ) : (
                                <Link
                                  href={childHref}
                                  className={cn(
                                    "block rounded px-2 py-1 transition hover:bg-primary/10 hover:text-primary",
                                    isChildActive ? "bg-primary/10 text-primary" : ""
                                  )}
                                  onClick={closeMenu}
                                >
                                  {child.title}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>
          {socialLinks.length > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ikuti Kami
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {socialLinks.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <a
                      key={entry.key}
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                      aria-label={entry.label}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>,
    portalTarget
  );
}
