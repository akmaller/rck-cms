import { notFound } from "next/navigation";

import { MenuItemForm } from "@/components/forms/menu-item-form";
import { MenuTree, MenuTreeNode } from "@/components/menu/menu-tree";
import { MenuSelector } from "@/components/menu/menu-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

const DEFAULT_MENU = "main";

type MenusPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

type MenuItemModel = Awaited<ReturnType<typeof prisma.menuItem.findMany>>[number];

function buildTree(items: MenuItemModel[]): MenuTreeNode[] {
  const map = new Map<string, MenuTreeNode>();
  const roots: MenuTreeNode[] = [];

  items.forEach((item) => {
    map.set(item.id, {
      id: item.id,
      title: item.title,
      slug: item.slug,
      url: item.url,
      order: item.order,
      children: [],
    });
  });

  items.forEach((item) => {
    const node = map.get(item.id);
    if (!node) return;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default async function MenusPage({ searchParams }: MenusPageProps) {
  const menuParam = searchParams.menu;
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

  const tree = buildTree(menuItems);

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
            <MenuTree items={tree} />
          </CardContent>
        </Card>
        <MenuItemForm
          menu={selectedMenu}
          parents={menuItems.map((item) => ({ id: item.id, title: item.title }))}
          pages={pages.map((page) => ({ id: page.id, title: page.title }))}
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
          <CardDescription>Fitur reorder dan visibilitas akan ditambahkan berikutnya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{`Menu aktif: ${selectedMenu}.`}</p>
          <p>Menambahkan dukungan drag & drop akan mempermudah penyusunan ulang.</p>
        </CardContent>
      </Card>
    </div>
  );
}
