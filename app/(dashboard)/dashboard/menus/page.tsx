import { notFound } from "next/navigation";

import { MenuItemForm } from "@/components/forms/menu-item-form";
import { MenuBuilder } from "@/components/menu/menu-builder";
import { MenuSelector } from "@/components/menu/menu-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { auth } from "@/auth";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { buildMenuTree, flattenMenuTree } from "@/lib/menu/utils";

const DEFAULT_MENU = "main";

type MenusPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MenusPage({ searchParams }: MenusPageProps) {
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || !(["ADMIN", "EDITOR"] as RoleKey[]).includes(role)) {
    return (
      <DashboardUnauthorized description="Hanya Admin dan Editor yang dapat mengatur menu navigasi." />
    );
  }

  const menuParam = resolvedSearchParams.menu;
  const selectedMenu = typeof menuParam === "string" && menuParam.length > 0 ? menuParam : DEFAULT_MENU;

  const [distinctMenus, menuItems, pages] = await Promise.all([
    prisma.menuItem.findMany({ distinct: ["menu"], select: { menu: true }, orderBy: { menu: "asc" } }),
    prisma.menuItem.findMany({ where: { menu: selectedMenu }, orderBy: [{ parentId: "asc" }, { order: "asc" }] }),
    prisma.page.findMany({ select: { id: true, title: true } }),
  ]);

  const menuNames = Array.from(new Set([selectedMenu, ...distinctMenus.map((item) => item.menu), "main", "footer"]));
  if (!menuNames.includes(selectedMenu)) {
    notFound();
  }

  const flatRecords = menuItems.map((item) => ({
    id: item.id,
    menu: item.menu,
    title: item.title,
    slug: item.slug,
    url: item.url,
    icon: item.icon,
    order: item.order,
    parentId: item.parentId,
    pageId: item.pageId,
  }));

  const tree = buildMenuTree(flatRecords);
  const parentOptions = flattenMenuTree(tree).map((item) => ({ id: item.id, title: item.title }));

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Menu Builder"
        description="Kelola struktur navigasi untuk tampilan publik."
      />
      <div className="flex justify-end">
        <MenuSelector menus={menuNames} />
      </div>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Struktur Menu</CardTitle>
            <CardDescription>Urutan dan hierarki menu {selectedMenu}.</CardDescription>
          </CardHeader>
          <CardContent>
            <MenuBuilder
              menu={selectedMenu}
              items={tree}
              pages={pages.map((page) => ({ id: page.id, title: page.title }))}
            />
          </CardContent>
        </Card>
        <MenuItemForm
          menu={selectedMenu}
          parents={parentOptions}
          pages={pages.map((page) => ({ id: page.id, title: page.title }))}
        />
      </section>
    </div>
  );
}
