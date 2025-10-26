export type MenuNode = {
  id: string;
  menu: string;
  title: string;
  slug: string | null;
  url: string | null;
  icon: string | null;
  order: number;
  parentId: string | null;
  pageId: string | null;
  children: MenuNode[];
};

export type FlatMenuRecord = {
  id: string;
  menu: string;
  title: string;
  slug: string | null;
  url: string | null;
  icon: string | null;
  order: number;
  parentId: string | null;
  pageId: string | null;
};

export function buildMenuTree(items: FlatMenuRecord[]): MenuNode[] {
  const nodes = new Map<string, MenuNode>();
  const roots: MenuNode[] = [];
  const sorted = [...items].sort((a, b) => a.order - b.order);

  sorted.forEach((item) => {
    const node: MenuNode = {
      id: item.id,
      menu: item.menu,
      title: item.title,
      slug: item.slug,
      url: item.url,
      icon: item.icon,
      order: item.order,
      parentId: item.parentId,
      pageId: item.pageId,
      children: [],
    };
    nodes.set(node.id, node);
  });

  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRecursive = (list: MenuNode[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((child, index) => {
      child.order = index;
      sortRecursive(child.children);
    });
  };

  sortRecursive(roots);
  return roots;
}

export function flattenMenuTree(nodes: MenuNode[], depth = 0, parentId: string | null = null) {
  const flattened: Array<{
    id: string;
    title: string;
    slug: string | null;
    url: string | null;
    icon: string | null;
    parentId: string | null;
    order: number;
    depth: number;
    pageId: string | null;
  }> = [];

  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  sorted.forEach((node, index) => {
    flattened.push({
      id: node.id,
      title: node.title,
      slug: node.slug,
      url: node.url,
      icon: node.icon,
      parentId,
      order: index,
      depth,
      pageId: node.pageId,
    });

    flattened.push(...flattenMenuTree(node.children, depth + 1, node.id));
  });

  return flattened;
}

const SAFE_PATH_REGEX = /^[A-Za-z0-9\-\/]+$/;
const ALLOWED_URL_SCHEMES = new Set(["http", "https", "mailto", "tel", "sms"]);

function sanitizeSlugPath(slug: string | null): string | null {
  if (!slug) return null;
  const trimmed = slug.trim().replace(/^\/+/, "");
  if (!trimmed || !SAFE_PATH_REGEX.test(trimmed)) {
    return null;
  }
  return `/${trimmed}`;
}

function sanitizeExternalUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    return trimmed.replace(/\/{2,}/g, "/");
  }
  const scheme = trimmed.split(":")[0]?.toLowerCase();
  if (scheme && ALLOWED_URL_SCHEMES.has(scheme)) {
    if (scheme === "http" || scheme === "https") {
      try {
        return new URL(trimmed).toString();
      } catch {
        return null;
      }
    }
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
    if (ALLOWED_URL_SCHEMES.has(scheme)) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveMenuHref(slug: string | null, url: string | null): string {
  return sanitizeExternalUrl(url) ?? sanitizeSlugPath(slug) ?? "#";
}
