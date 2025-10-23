"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";

import { updateCategory, deleteCategory } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articleCount: number;
  createdAt: string;
};

export type CategoryListProps = {
  items: CategoryListItem[];
};

export function CategoryList({ items }: CategoryListProps) {
  const [list, setList] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, { name: string; slug: string; description: string }>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { name: item.name, slug: item.slug, description: item.description ?? "" }])
    )
  );
  const [feedback, setFeedback] = useState<{ id: string; message: string; variant: "error" | "success" } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setList(items);
    setFormState(
      Object.fromEntries(
        items.map((item) => [item.id, { name: item.name, slug: item.slug, description: item.description ?? "" }])
      )
    );
  }, [items]);

  const handleEdit = (id: string) => {
    setEditingId((current) => (current === id ? null : id));
    setFeedback(null);
  };

  const handleChange = (id: string, field: "name" | "slug" | "description", value: string) => {
    setFormState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { name: "", slug: "", description: "" }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = (id: string) => {
    const draft = formState[id];
    if (!draft) return;
    const payload = new FormData();
    payload.set("id", id);
    payload.set("name", draft.name);
    if (draft.slug) payload.set("slug", draft.slug);
    if (draft.description) payload.set("description", draft.description);

    startTransition(async () => {
      const result = await updateCategory(payload);
      if (result?.error) {
        setFeedback({ id, message: result.error, variant: "error" });
        return;
      }
      setFeedback({ id, message: "Kategori diperbarui", variant: "success" });
      setEditingId(null);
      if (result?.data) {
        setList((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  id: result.data.id,
                  name: result.data.name,
                  slug: result.data.slug,
                  description: result.data.description,
                  articleCount: result.data._count.articles,
                  createdAt: new Date(result.data.createdAt).toISOString(),
                }
              : item
          )
        );
        setFormState((prev) => ({
          ...prev,
          [id]: {
            name: result.data.name,
            slug: result.data.slug,
            description: result.data.description ?? "",
          },
        }));
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result?.error) {
        setFeedback({ id, message: result.error, variant: "error" });
        return;
      }
      setList((prev) => prev.filter((item) => item.id !== id));
      setEditingId((current) => (current === id ? null : current));
      setFormState((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setFeedback(null);
    });
  };

  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada kategori.</p>;
  }

  return (
    <div className="space-y-3">
      {list.map((item) => {
        const draft = formState[item.id] ?? { name: item.name, slug: item.slug, description: item.description ?? "" };
        const isEditingCurrent = editingId === item.id;
        const feedbackMessage = feedback && feedback.id === item.id ? feedback.message : null;
        const feedbackVariant = feedback && feedback.id === item.id ? feedback.variant : "success";
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-md border border-border/60 bg-card p-3 text-sm transition",
              isEditingCurrent ? "ring-2 ring-primary/40" : undefined
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">slug: {item.slug} • {item.articleCount} artikel</p>
                {item.description ? (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(item.id)} disabled={isPending}>
                  {isEditingCurrent ? "Batal" : "Edit"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} disabled={isPending}>
                  Hapus
                </Button>
              </div>
            </div>
            {isEditingCurrent ? (
              <div className="mt-4 space-y-3 rounded-md border border-border/60 bg-muted/10 p-3">
                <div className="space-y-2">
                  <Label htmlFor={`category-name-${item.id}`}>Nama</Label>
                  <Input
                    id={`category-name-${item.id}`}
                    value={draft.name}
                    onChange={(event) => handleChange(item.id, "name", event.target.value)}
                    placeholder="Nama kategori"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`category-slug-${item.id}`}>Slug (opsional)</Label>
                  <Input
                    id={`category-slug-${item.id}`}
                    value={draft.slug}
                    onChange={(event) => handleChange(item.id, "slug", event.target.value)}
                    placeholder="slug-kategori"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`category-description-${item.id}`}>Deskripsi</Label>
                  <Textarea
                    id={`category-description-${item.id}`}
                    value={draft.description}
                    onChange={(event) => handleChange(item.id, "description", event.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleSubmit(item.id)} disabled={isPending}>
                    {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                  {feedbackMessage ? (
                    <p
                      className={cn(
                        "text-xs",
                        feedbackVariant === "error" ? "text-destructive" : "text-emerald-600"
                      )}
                    >
                      {feedbackMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
