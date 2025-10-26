import type { ReactNode } from "react";

import { SettingsNavigation } from "./_components/settings-navigation";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsNavigation />
      {children}
    </div>
  );
}
