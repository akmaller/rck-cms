"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notifications/client";
import type { MenuNode } from "@/lib/menu/utils";
import { flattenMenuTree, buildMenuTree } from "@/lib/menu/utils";

const INDENTATION_WIDTH = 24;

type PageOption = {
  id: string;
  title: string;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type AlbumOption = {
  id: string;
  title: string;
};

type MenuBuilderProps = {
  menu: string;
  items: MenuNode[];
  pages: PageOption[];
  categories: CategoryOption[];
  albums: AlbumOption[];
};

type FlattenedItem = ReturnType<typeof flattenMenuTree>[number];

type Projection = {
  depth: number;
  parentId: string | null;
};

function normalizeSiblingOrder(items: FlattenedItem[]) {
  const updated = items.map((item) => ({ ...item }));
  const groups = new Map<string, FlattenedItem[]>();

  updated.forEach((item) => {
    const key = item.parentId ?? "__root__";
    const siblings = groups.get(key);
    if (siblings) {
      siblings.push(item);
    } else {
      groups.set(key, [item]);
    }
  });

  groups.forEach((siblings) => {
    siblings.forEach((sibling, index) => {
      sibling.order = index;
    });
  });

  return updated;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getProjection(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  offsetLeft: number
): Projection | null {
  const activeItem = items.find((item) => item.id === activeId);
  const overItem = items.find((item) => item.id === overId);

  if (!activeItem || !overItem) {
    return null;
  }

  const activeIndex = items.indexOf(activeItem);
  const overIndex = items.indexOf(overItem);
  const newItems = arrayMove(items, activeIndex, overIndex);
  const previousItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];
  const dragDepth = Math.round(offsetLeft / INDENTATION_WIDTH);
  const depth = clamp(activeItem.depth + dragDepth, 0, previousItem ? previousItem.depth + 1 : 0);
  const parentId = getParentIdForDepth(newItems, overIndex, depth);

  if (nextItem && depth > nextItem.depth) {
    return null;
  }

  return { depth, parentId };
}

function getParentIdForDepth(items: FlattenedItem[], index: number, depth: number) {
  if (depth === 0) {
    return null;
  }

  for (let i = index - 1; i >= 0; i--) {
    const item = items[i];
    if (item.depth === depth - 1) {
      return item.id;
    }
  }
  return null;
}

function SortableMenuItem({
  item,
  depth,
  onEdit,
  onDelete,
  disabled,
}: {
  item: FlattenedItem;
  depth: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="select-none">
      <div
        className={`flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-sm transition ${
          isDragging ? "opacity-60" : ""
        }`}
        style={{ paddingLeft: depth * INDENTATION_WIDTH + 12 }}
      >
        <div className={`flex flex-col ${disabled ? "cursor-not-allowed" : "cursor-grab"}`} {...listeners} {...attributes}>
          <span className="font-medium text-foreground">{item.title}</span>
          <span className="text-xs text-muted-foreground">
            {item.url ? item.url : item.slug ? `/${item.slug}` : "(tanpa tautan)"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(item.id)} disabled={disabled}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)} disabled={disabled}>
            Hapus
          </Button>
        </div>
      </div>
    </div>
  );
}

type EditState = {
  id: string;
  title: string;
  slug: string | null;
  url: string | null;
  icon: string | null;
  parentId: string | null;
  pageId: string | null;
  categorySlug: string | null;
  albumId: string | null;
};

export function MenuBuilder({ menu, items, pages, categories, albums }: MenuBuilderProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [tree, setTree] = useState<MenuNode[]>(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentProjection, setCurrentProjection] = useState<Projection | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setTree(items);
  }, [items]);

  const flattenedItems = useMemo(() => flattenMenuTree(tree), [tree]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const activeItem = activeId ? flattenedItems.find((item) => item.id === activeId) : null;
  const projectedDepth = activeId && currentProjection ? currentProjection.depth : undefined;

  const persistReorder = async (nextTree: MenuNode[]) => {
    const payload = flattenMenuTree(nextTree).map((item) => ({
      id: item.id,
      parentId: item.parentId,
      order: item.order,
    }));

    try {
      const response = await fetch("/api/dashboard/menus/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu, items: payload }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal memperbarui urutan menu.");
      }
      notifySuccess("Urutan menu diperbarui.");
    } catch (error) {
      console.error(error);
      notifyError("Gagal memperbarui urutan menu.");
    } finally {
      router.refresh();
    }
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setCurrentProjection(null);
  };

  const handleDragMove = ({ active, over, delta }: DragMoveEvent) => {
    if (!over) return;
    setOffsetLeft(delta.x);
    const projection = getProjection(flattenedItems, String(active.id), String(over.id), delta.x);
    if (projection) {
      setCurrentProjection(projection);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setCurrentProjection(null);
    setOffsetLeft(0);
    if (!over) return;

    const activeIndex = flattenedItems.findIndex((item) => item.id === active.id);
    const overIndex = flattenedItems.findIndex((item) => item.id === over.id);

    if (activeIndex === overIndex || activeIndex === -1 || overIndex === -1) {
      return;
    }

    const reordered = arrayMove(flattenedItems, activeIndex, overIndex).map((item) => ({ ...item }));
    const projection = getProjection(flattenedItems, String(active.id), String(over.id), offsetLeft);
    if (projection) {
      const item = reordered[overIndex];
      if (item) {
        item.depth = projection.depth;
        item.parentId = projection.parentId;
      }
    }

    const normalized = normalizeSiblingOrder(reordered);

    const nextTree = buildMenuTree(
      normalized.map((item) => ({
        id: item.id,
        menu,
        title: item.title,
        slug: item.slug,
        url: item.url,
        icon: item.icon,
        order: item.order,
        parentId: item.parentId,
        pageId: item.pageId ?? null,
      }))
    );

    setTree(nextTree);
    persistReorder(nextTree);
  };

  const handleEdit = (id: string) => {
    const original = findNode(tree, id);
    if (!original) return;
    const categorySlug =
      original.slug && original.slug.startsWith("categories/")
        ? original.slug.replace(/^categories\//, "")
        : null;
    const albumId =
      original.slug && original.slug.startsWith("albums/")
        ? original.slug.replace(/^albums\//, "")
        : null;
    setEditing({
      id: original.id,
      title: original.title,
      slug: original.slug,
      url: original.url,
      icon: original.icon,
      parentId: original.parentId,
      pageId: original.pageId,
      categorySlug,
      albumId,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus item menu beserta turunannya?")) {
      return;
    }
    setDeletingId(id);
    try {
      const response = await fetch(`/api/dashboard/menus/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal menghapus item menu");
      }
      notifySuccess("Item menu dihapus.");
      router.refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Gagal menghapus item menu");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    if (!title || title.length < 2) {
      notifyError("Judul minimal 2 karakter");
      setSavingEdit(false);
      return;
    }
    const payload: Record<string, unknown> = { title };
    const slug = String(formData.get("slug") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim();
    const pageId = String(formData.get("pageId") ?? "").trim();
    const categorySlug = String(formData.get("categorySlug") ?? "").trim();
    const albumId = String(formData.get("albumId") ?? "").trim();

    payload.icon = icon ? icon : "";

    if (albumId) {
      payload.albumId = albumId;
      payload.slug = "";
      payload.url = "";
      payload.pageId = null;
      payload.categorySlug = "";
    } else if (pageId) {
      payload.pageId = pageId;
      payload.albumId = null;
      payload.categorySlug = "";
      payload.slug = "";
      payload.url = "";
    } else if (categorySlug) {
      payload.categorySlug = categorySlug;
      payload.pageId = null;
      payload.albumId = null;
      payload.slug = "";
      payload.url = "";
    } else {
      payload.albumId = null;
      payload.pageId = null;
      payload.categorySlug = "";
      payload.slug = slug ? slug : "";
      payload.url = url ? url : "";
    }

    try {
      const response = await fetch(`/api/dashboard/menus/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal memperbarui item menu");
      }
      notifySuccess("Item menu diperbarui.");
      setEditing(null);
      router.refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Gagal memperbarui item menu");
    } finally {
      setSavingEdit(false);
    }
  };

  const sensorsProps = {
    sensors,
    collisionDetection: closestCenter,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
  };

  const renderEditModal = () => {
    if (!editing) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
          <form className="space-y-4" onSubmit={handleSaveEdit}>
            <div>
              <Label htmlFor="title-edit">Judul</Label>
              <Input id="title-edit" name="title" defaultValue={editing.title} required />
            </div>
            <div>
              <Label htmlFor="slug-edit">Slug</Label>
              <Input id="slug-edit" name="slug" defaultValue={editing.slug ?? ""} />
            </div>
            <div>
              <Label htmlFor="url-edit">URL</Label>
              <Input id="url-edit" name="url" defaultValue={editing.url ?? ""} placeholder="https://" />
            </div>
            <div>
              <Label htmlFor="icon-edit">Ikon (opsional)</Label>
              <Input id="icon-edit" name="icon" defaultValue={editing.icon ?? ""} />
            </div>
            <div>
              <Label htmlFor="pageId-edit">Halaman</Label>
              <select
                id="pageId-edit"
                name="pageId"
                defaultValue={editing.pageId ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">(Tidak ada)</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="categorySlug-edit">Kategori</Label>
              <select
                id="categorySlug-edit"
                name="categorySlug"
                defaultValue={editing.categorySlug ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">(Tidak ada)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="albumId-edit">Album</Label>
              <select
                id="albumId-edit"
                name="albumId"
                defaultValue={editing.albumId ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">(Tidak ada)</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Gunakan salah satu sumber tautan (halaman, kategori, atau album) atau kosongkan untuk custom link.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
                Batal
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="space-y-4">
      <DndContext {...sensorsProps}>
        <SortableContext items={flattenedItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {flattenedItems.length === 0 ? (
              <div className="rounded border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                Menu belum memiliki item. Tambahkan item baru dari form di samping.
              </div>
            ) : (
              flattenedItems.map((item) => (
                <SortableMenuItem
                  key={item.id}
                  item={item}
                  depth={projectedDepth !== undefined && activeId === item.id ? projectedDepth : item.depth}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  disabled={deletingId === item.id}
                />
              ))
            )}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div
              className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
              style={{ paddingLeft: (projectedDepth ?? activeItem.depth) * INDENTATION_WIDTH + 12 }}
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{activeItem.title}</span>
                <span className="text-xs text-muted-foreground">
                  {activeItem.url ? activeItem.url : activeItem.slug ? `/${activeItem.slug}` : "(tanpa tautan)"}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {renderEditModal()}
    </div>
  );
}

function findNode(nodes: MenuNode[], id: string): MenuNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const child = findNode(node.children, id);
    if (child) {
      return child;
    }
  }
  return null;
}
