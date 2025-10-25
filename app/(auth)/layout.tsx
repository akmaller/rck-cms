import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="min-h-screen" role="main">
        {children}
      </main>
    </div>
  );
}
