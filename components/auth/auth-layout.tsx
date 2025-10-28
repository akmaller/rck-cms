import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  hero: ReactNode;
  children: ReactNode;
  className?: string;
  heroClassName?: string;
  contentClassName?: string;
};

export function AuthLayout({
  hero,
  children,
  className,
  heroClassName,
  contentClassName,
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen items-center justify-center bg-sky-50/80 px-4 py-10 sm:px-6 lg:px-8",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-40 w-40 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-24 right-12 h-36 w-36 rounded-full bg-indigo-200/60 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-3xl bg-white/95 shadow-2xl ring-1 ring-sky-100/80 backdrop-blur lg:grid-cols-[1.08fr_1fr]">
        <div
          className={cn(
            "relative flex flex-col justify-center bg-gradient-to-br from-sky-100 via-white to-indigo-100 px-8 py-12 sm:px-10",
            heroClassName
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.32),_transparent_60%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.28),_transparent_55%)]" />
          <div className="pointer-events-none absolute -left-10 top-20 hidden h-40 w-40 rounded-full bg-white/40 blur-3xl lg:block" />
          <div className="pointer-events-none absolute -bottom-12 right-16 hidden h-32 w-32 rounded-full bg-white/40 blur-3xl lg:block" />
          <div className="relative mx-auto flex w-full max-w-md flex-col gap-8 text-slate-800">
            {hero}
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-16",
            contentClassName
          )}
        >
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
