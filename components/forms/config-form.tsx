"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";

import { updateSiteConfig } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications/client";

const TIMEZONE_OPTIONS = [
  "UTC",
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
] as const;

export type ConfigValues = {
  siteName?: string;
  siteUrl?: string;
  logoUrl?: string;
  iconUrl?: string;
  tagline?: string;
  timezone?: string;
  contactEmail?: string;
  cacheEnabled?: boolean;
  cache?: {
    enabled?: boolean;
  };
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
  registration?: {
    enabled?: boolean;
    autoApprove?: boolean;
  };
};

type ConfigFormProps = {
  initialConfig: ConfigValues;
};

export function ConfigForm({ initialConfig }: ConfigFormProps) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [isPending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(initialConfig.logoUrl ?? "");
  const [iconUrl, setIconUrl] = useState(initialConfig.iconUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initialConfig.registration?.enabled ?? true
  );
  const [registrationAutoApprove, setRegistrationAutoApprove] = useState(
    initialConfig.registration?.autoApprove ?? false
  );

  const keywordsString = useMemo(
    () => initialConfig.metadata?.keywords?.join(", ") ?? "",
    [initialConfig.metadata?.keywords]
  );

  const uploadAsset = async (file: File, type: "logo" | "icon") => {
    if (!file.type.startsWith("image/")) {
      notifyError("Hanya file gambar yang didukung.");
      return;
    }

    const isLogo = type === "logo";
    if (isLogo) {
      setUploadingLogo(true);
    } else {
      setUploadingIcon(true);
    }
    notifyInfo(isLogo ? "Mengunggah logo..." : "Mengunggah ikon...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/dashboard/settings/brand-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal mengunggah gambar");
      }
      const json = await response.json();
      const url = json?.data?.url as string;
      if (!url) {
        throw new Error("Respons unggahan tidak valid");
      }
      if (isLogo) {
        setLogoUrl(url);
        notifySuccess("Logo berhasil diperbarui.");
      } else {
        setIconUrl(url);
        notifySuccess("Ikon berhasil diperbarui.");
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Gagal mengunggah gambar");
    } finally {
      if (isLogo) {
        setUploadingLogo(false);
      } else {
        setUploadingIcon(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Umum</CardTitle>
        <CardDescription>Perbarui identitas, pengaturan waktu, dan metadata situs.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          form.set("logoUrl", logoUrl);
          form.set("iconUrl", iconUrl);
          startTransition(async () => {
            const result = await updateSiteConfig(form);
            if (result?.error) {
              setState({ error: result.error });
              notifyError(result.error);
              return;
            }
            setState({ success: true });
            notifySuccess("Konfigurasi situs telah diperbarui.");
          });
        }}
      >
        <CardContent className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteName">Nama Situs</Label>
              <Input id="siteName" name="siteName" defaultValue={initialConfig.siteName ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteUrl">URL Website</Label>
              <Input
                id="siteUrl"
                name="siteUrl"
                placeholder="https://contoh.com"
                defaultValue={initialConfig.siteUrl ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                URL utama digunakan untuk sitemap, SEO, dan tautan publik.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" name="tagline" defaultValue={initialConfig.tagline ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Waktu</Label>
              <select
                id="timezone"
                name="timezone"
                defaultValue={initialConfig.timezone ?? "UTC"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {TIMEZONE_OPTIONS.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Zona waktu ini digunakan sebagai referensi untuk publikasi dan pencatatan log.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email Kontak</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={initialConfig.contactEmail ?? ""}
                placeholder="email@contoh.com"
              />
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="/logo.svg atau https://..."
              />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.files?.[0]) {
                        uploadAsset(target.files[0], "logo");
                      }
                    };
                    input.click();
                  }}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? "Mengunggah..." : "Unggah Logo"}
                </Button>
                {logoUrl ? <span>Pratinjau di bawah.</span> : null}
              </div>
              {logoUrl ? (
                <div className="mt-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                  <Image src={logoUrl} alt="Logo" width={80} height={80} className="object-contain" />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="iconUrl">Ikon Situs</Label>
              <Input
                id="iconUrl"
                name="iconUrl"
                value={iconUrl}
                onChange={(event) => setIconUrl(event.target.value)}
                placeholder="/favicon.ico atau https://..."
              />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.files?.[0]) {
                        uploadAsset(target.files[0], "icon");
                      }
                    };
                    input.click();
                  }}
                  disabled={uploadingIcon}
                >
                  {uploadingIcon ? "Mengunggah..." : "Unggah Ikon"}
                </Button>
              </div>
              {iconUrl ? (
                <div className="mt-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                  <Image src={iconUrl} alt="Ikon" width={48} height={48} className="object-contain" />
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Media Sosial</h3>
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
                  placeholder="https://twitter.com/"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Metadata & SEO</h3>
            <div className="space-y-2">
              <Label htmlFor="metadata.title">Judul Metadata</Label>
              <Input
                id="metadata.title"
                name="metadata.title"
                defaultValue={initialConfig.metadata?.title ?? ""}
                placeholder="Judul default untuk SEO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata.description">Deskripsi Metadata</Label>
              <Textarea
                id="metadata.description"
                name="metadata.description"
                rows={3}
                placeholder="Deskripsi singkat untuk mesin pencari."
                defaultValue={initialConfig.metadata?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata.keywords">Kata Kunci</Label>
              <Input
                id="metadata.keywords"
                name="metadata.keywords"
                defaultValue={keywordsString}
                placeholder="pisahkan dengan koma, contoh: budaya, kuliner"
              />
              <p className="text-xs text-muted-foreground">Maksimal 10 kata kunci, dipisahkan koma.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Registrasi Penulis Publik</h3>
            <p className="text-xs text-muted-foreground">
              Tentukan apakah publik dapat mendaftar sebagai penulis dan apakah akun baru otomatis diizinkan menulis setelah aktivasi email.
            </p>
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
              <div className="flex items-start gap-3">
                <input type="hidden" name="registration.enabled" value="false" />
                <input
                  id="registration.enabled"
                  name="registration.enabled"
                  type="checkbox"
                  value="true"
                  checked={registrationEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setRegistrationEnabled(enabled);
                    if (!enabled) {
                      setRegistrationAutoApprove(false);
                    }
                  }}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <Label htmlFor="registration.enabled" className="text-sm font-medium">
                    Izinkan registrasi mandiri publik
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Jika dinonaktifkan, tautan registrasi tidak ditampilkan dan pendaftaran ditolak.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 pl-7">
                <input type="hidden" name="registration.autoApprove" value="false" />
                <input
                  id="registration.autoApprove"
                  name="registration.autoApprove"
                  type="checkbox"
                  value="true"
                  checked={registrationAutoApprove}
                  onChange={(event) => setRegistrationAutoApprove(event.target.checked)}
                  disabled={!registrationEnabled}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <Label htmlFor="registration.autoApprove" className="text-sm font-medium">
                    Otomatis izinkan menulis setelah aktivasi email
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Jika dimatikan, penulis baru harus menunggu persetujuan admin/editor sebelum bisa menulis artikel.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Cache Halaman Publik</h3>
            <p className="text-xs text-muted-foreground">
              Aktifkan cache untuk meningkatkan performa. Anda dapat menonaktifkannya saat melakukan perubahan besar.
            </p>
            <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/10 p-3">
              <input type="hidden" name="cacheEnabled" value="false" />
              <input
                id="cacheEnabled"
                name="cacheEnabled"
                type="checkbox"
                value="true"
                defaultChecked={initialConfig.cacheEnabled ?? true}
                className="h-4 w-4"
              />
              <Label htmlFor="cacheEnabled" className="text-sm font-medium">
                Aktifkan cache pada halaman publik
              </Label>
            </div>
          </section>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : (
            <span className="text-xs text-muted-foreground">
              Simpan perubahan untuk menerapkannya di seluruh situs.
            </span>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
