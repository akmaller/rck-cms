"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createMenuItemAction } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

type ParentOption = {
  id: string;
  title: string;
};

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

type LinkType = "custom" | "page" | "category" | "album";

type MenuItemFormProps = {
  menu: string;
  parents: ParentOption[];
  pages: PageOption[];
  categories: CategoryOption[];
  albums: AlbumOption[];
};

export function MenuItemForm({ menu, parents, pages, categories, albums }: MenuItemFormProps) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [linkType, setLinkType] = useState<LinkType>("custom");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const canUsePage = pages.length > 0;
  const canUseCategory = categories.length > 0;
  const canUseAlbum = albums.length > 0;
  const resolvedLinkType = useMemo<LinkType>(() => {
    if (linkType === "page" && !canUsePage) return "custom";
    if (linkType === "category" && !canUseCategory) return "custom";
    if (linkType === "album" && !canUseAlbum) return "custom";
    return linkType;
  }, [linkType, canUsePage, canUseCategory, canUseAlbum]);

  const handleTypeChange = (value: string) => {
    if (!value) {
      setLinkType("custom");
      return;
    }
    if (value === "custom" || value === "page" || value === "category" || value === "album") {
      setLinkType(value as LinkType);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Item Menu</CardTitle>
        <CardDescription>Tentukan judul dan sumber tautan yang ingin ditampilkan di navigasi.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          form.set("menu", menu);
          setState({});

          if (resolvedLinkType === "page") {
            const pageId = String(form.get("pageId") ?? "").trim();
            if (!pageId) {
              const message = "Pilih halaman statis terlebih dahulu.";
              setState({ error: message });
              notifyError(message);
              return;
            }
          } else if (resolvedLinkType === "category") {
            const categorySlug = String(form.get("categorySlug") ?? "").trim();
            if (!categorySlug) {
              const message = "Pilih kategori yang ingin ditautkan.";
              setState({ error: message });
              notifyError(message);
              return;
            }
          } else if (resolvedLinkType === "album") {
            const albumId = String(form.get("albumId") ?? "").trim();
            if (!albumId) {
              const message = "Pilih album yang ingin ditautkan.";
              setState({ error: message });
              notifyError(message);
              return;
            }
          }

          if (resolvedLinkType !== "custom") {
            form.delete("url");
            form.delete("slug");
          }
          if (resolvedLinkType !== "page") {
            form.delete("pageId");
          }
          if (resolvedLinkType !== "category") {
            form.delete("categorySlug");
          }
          if (resolvedLinkType !== "album") {
            form.delete("albumId");
          }

          startTransition(async () => {
            const result = await createMenuItemAction(form);
            if (result?.error) {
              setState({ error: result.error });
              notifyError(result.error);
              return;
            }
            formElement.reset();
            setState({ success: true });
            setLinkType("custom");
            notifySuccess("Item menu ditambahkan.");
            router.refresh();
          });
        }}
      >
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" required placeholder="Mis. Album Kegiatan" />
          </div>
          <div className="space-y-2">
            <Label>Sumber tautan</Label>
            <ToggleGroup
              type="single"
              value={resolvedLinkType}
              onValueChange={handleTypeChange}
              className="flex flex-wrap gap-2"
            >
              <ToggleGroupItem value="custom" aria-label="Tautan kustom">
                Custom link
              </ToggleGroupItem>
              <ToggleGroupItem value="page" aria-label="Halaman statis" disabled={!canUsePage}>
                Halaman statis
              </ToggleGroupItem>
              <ToggleGroupItem value="category" aria-label="Kategori" disabled={!canUseCategory}>
                Kategori
              </ToggleGroupItem>
              <ToggleGroupItem value="album" aria-label="Album" disabled={!canUseAlbum}>
                Album
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              Pilih jenis menu. Opsi lanjutan akan muncul sesuai pilihan Anda.
            </p>
          </div>

          {resolvedLinkType === "custom" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="url">Tautan (opsional)</Label>
                <Input id="url" name="url" placeholder="https://example.com atau /tentang-kami" type="url" />
                <p className="text-xs text-muted-foreground">
                  Gunakan URL penuh untuk tautan eksternal atau awali dengan &quot;/&quot; untuk halaman internal.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="slug">Slug (opsional)</Label>
                <Input id="slug" name="slug" placeholder="mis. layanan-kami" />
                <p className="text-xs text-muted-foreground">
                  Jika kosong, slug akan dibuat otomatis dari judul menu.
                </p>
              </div>
            </div>
          ) : null}

          {resolvedLinkType === "page" ? (
            <div className="space-y-2">
              <Label htmlFor="pageId">Halaman statis</Label>
              <select
                id="pageId"
                name="pageId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Pilih halaman
                </option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Menu akan diarahkan ke halaman statis yang dipilih.
              </p>
            </div>
          ) : null}

          {resolvedLinkType === "category" ? (
            <div className="space-y-2">
              <Label htmlFor="categorySlug">Kategori</Label>
              <select
                id="categorySlug"
                name="categorySlug"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Menu akan menampilkan daftar artikel dalam kategori yang dipilih.
              </p>
            </div>
          ) : null}

          {resolvedLinkType === "album" ? (
            <div className="space-y-2">
              <Label htmlFor="albumId">Album</Label>
              <select
                id="albumId"
                name="albumId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Pilih album
                </option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Menu akan mengarah ke halaman publik album yang dipilih.
              </p>
            </div>
          ) : null}

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
          <div className="space-y-2">
            <Label htmlFor="order">Urutan</Label>
            <Input id="order" name="order" type="number" min={0} defaultValue={0} />
            <p className="text-xs text-muted-foreground">
              Angka yang lebih kecil akan tampil lebih awal pada level menu yang sama.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Item menu tersimpan.</p>
          ) : null}
          <Button type="submit" disabled={isPending} className="btn-gradient">
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
