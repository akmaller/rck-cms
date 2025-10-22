"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createMenuItem } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ParentOption = {
  id: string;
  title: string;
};

type PageOption = {
  id: string;
  title: string;
};

type MenuItemFormProps = {
  menu: string;
  parents: ParentOption[];
  pages: PageOption[];
};

export function MenuItemForm({ menu, parents, pages }: MenuItemFormProps) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Item Menu</CardTitle>
        <CardDescription>Tautkan ke halaman atau URL eksternal.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          form.set("menu", menu);
          startTransition(async () => {
            const result = await createMenuItem(form);
            if (result?.error) {
              setState({ error: result.error });
              return;
            }
            event.currentTarget.reset();
            setState({ success: true });
            router.refresh();
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" required placeholder="Mis. Beranda" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (opsional)</Label>
            <Input id="slug" name="slug" placeholder="beranda" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL (opsional)</Label>
            <Input id="url" name="url" placeholder="https://" type="url" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pageId">Halaman (opsional)</Label>
            <select
              id="pageId"
              name="pageId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">(Tidak ada)</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Pilih URL atau halaman saja.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent</Label>
            <select
              id="parentId"
              name="parentId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">(Tidak ada)</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">Urutan</Label>
              <Input id="order" name="order" type="number" min={0} defaultValue={0} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="isExternal" name="isExternal" type="checkbox" className="h-4 w-4" />
              <Label htmlFor="isExternal" className="text-sm font-normal">
                Tautan eksternal
              </Label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Menu item tersimpan.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
