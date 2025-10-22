"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type MenuSelectorProps = {
  menus: string[];
};

export function MenuSelector({ menus }: MenuSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("menu") ?? menus[0] ?? "main";

  return (
    <ToggleGroup
      type="single"
      value={current}
      onValueChange={(value) => {
        if (!value) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("menu", value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="w-fit flex-wrap"
    >
      {menus.map((menu) => (
        <ToggleGroupItem key={menu} value={menu} className="capitalize">
          {menu}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
