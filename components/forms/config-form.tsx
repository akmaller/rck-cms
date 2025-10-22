"use client";

import { useState, useTransition } from "react";

import { updateSiteConfig } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ConfigValues = {
  siteName?: string;
  logoUrl?: string;
  tagline?: string;
  contactEmail?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
};

type ConfigFormProps = {
  initialConfig: ConfigValues;
};

export function ConfigForm({ initialConfig }: ConfigFormProps) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Umum</CardTitle>
        <CardDescription>Perbarui identitas dan metadata situs.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await updateSiteConfig(form);
            if (result?.error) {
              setState({ error: result.error });
              return;
            }
            setState({ success: true });
          });
        }}
      >
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteName">Nama Situs</Label>
              <Input id="siteName" name="siteName" defaultValue={initialConfig.siteName ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" name="logoUrl" defaultValue={initialConfig.logoUrl ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email Kontak</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={initialConfig.contactEmail ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" name="tagline" defaultValue={initialConfig.tagline ?? ""} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Sosial Media</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="social.facebook">Facebook</Label>
                <Input
                  id="social.facebook"
                  name="social.facebook"
                  defaultValue={initialConfig.social?.facebook ?? ""}
                  placeholder="https://facebook.com/"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="social.instagram">Instagram</Label>
                <Input
                  id="social.instagram"
                  name="social.instagram"
                  defaultValue={initialConfig.social?.instagram ?? ""}
                  placeholder="https://instagram.com/"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="social.youtube">YouTube</Label>
                <Input
                  id="social.youtube"
                  name="social.youtube"
                  defaultValue={initialConfig.social?.youtube ?? ""}
                  placeholder="https://youtube.com/"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="social.twitter">Twitter/X</Label>
                <Input
                  id="social.twitter"
                  name="social.twitter"
                  defaultValue={initialConfig.social?.twitter ?? ""}
                  placeholder="https://x.com/"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <div className="space-y-2">
              <Label htmlFor="metadata.title">Judul Default</Label>
              <Input
                id="metadata.title"
                name="metadata.title"
                defaultValue={initialConfig.metadata?.title ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata.description">Deskripsi</Label>
              <Textarea
                id="metadata.description"
                name="metadata.description"
                rows={3}
                defaultValue={initialConfig.metadata?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata.keywords">Keywords</Label>
              <Input
                id="metadata.keywords"
                name="metadata.keywords"
                placeholder="pisahkan dengan koma"
                defaultValue={initialConfig.metadata?.keywords?.join(", ") ?? ""}
              />
              <p className="text-xs text-muted-foreground">Contoh: budaya, kuliner, komunitas</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success && !state.error ? (
            <p className="text-xs text-muted-foreground">Konfigurasi tersimpan.</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
