import { prisma } from "@/lib/prisma";
import { buildMenuTree, type MenuNode } from "@/lib/menu/utils";

export async function getMenuTree(menu: string): Promise<MenuNode[]> {
  const items = await prisma.menuItem.findMany({
    where: { menu },
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return buildMenuTree(
    items.map((item) => ({
      id: item.id,
      menu: item.menu,
      title: item.title,
      slug: item.slug,
      url: item.url,
      icon: item.icon,
      order: item.order,
      parentId: item.parentId,
      pageId: item.pageId,
    }))
  );
}
