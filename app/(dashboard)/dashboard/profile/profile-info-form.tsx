"use client";

import { useMemo, useState, useTransition } from "react";

import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AUTHOR_SOCIAL_FIELDS, type AuthorSocialKey } from "@/lib/authors/social-links";
import { notifyError, notifySuccess } from "@/lib/notifications/client";
import { findForbiddenMatch, normalizeForComparison } from "@/lib/moderation/filter-utils";

type ProfileInfoFormProps = {
  initialData: {
    name: string;
    email: string;
    bio: string | null;
    socialLinks: Partial<Record<AuthorSocialKey, string | null>> | Record<string, string | null>;
  };
  forbiddenPhrases?: string[];
};

export function ProfileInfoForm({ initialData, forbiddenPhrases = [] }: ProfileInfoFormProps) {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const socialInitialValues = useMemo(() => initialData.socialLinks ?? {}, [initialData.socialLinks]);
  const forbiddenEntries = useMemo(
    () =>
      forbiddenPhrases
        .map((phrase) => ({ phrase, normalized: normalizeForComparison(phrase) }))
        .filter((item) => item.normalized.length > 0),
    [forbiddenPhrases]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Profil</CardTitle>
        <CardDescription>
          Perbarui nama tampilan, email, bio singkat, serta tautan media sosial Anda.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const formData = new FormData(formElement);
          if (forbiddenEntries.length) {
            const bioValue = formData.get("bio");
            const match = findForbiddenMatch(
              typeof bioValue === "string" ? bioValue : null,
              forbiddenEntries
            );
            if (match) {
              const message = `Bio mengandung kata/kalimat terlarang "${match.phrase}". Hapus kata tersebut sebelum melanjutkan.`;
              setStatus({ type: "error", message });
              notifyError(message);
              return;
            }
          }
          startTransition(async () => {
            const result = await updateProfile(formData);
            if (!result.success) {
              setStatus({ type: "error", message: result.message });
              notifyError(result.message);
              return;
            }
            setStatus({ type: "success", message: result.message });
            notifySuccess(result.message);
          });
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initialData.name}
              placeholder="Nama lengkap Anda"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={initialData.email}
              placeholder="email@contoh.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              defaultValue={initialData.bio ?? ""}
              placeholder="Ceritakan secara singkat tentang diri Anda (maksimal 500 karakter)"
              rows={5}
            />
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold text-foreground">Media Sosial</Label>
              <p className="text-xs text-muted-foreground">
                Cantumkan tautan lengkap profil Anda. Kosongkan jika tidak ingin ditampilkan.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {AUTHOR_SOCIAL_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`socialLinks.${field.key}`}>{field.label}</Label>
                  <Input
                    id={`socialLinks.${field.key}`}
                    name={`socialLinks.${field.key}`}
                    type="url"
                    defaultValue={socialInitialValues?.[field.key] ?? ""}
                    placeholder={field.placeholder}
                    inputMode="url"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          {status ? (
            <p
              className={`text-sm ${
                status.type === "success" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {status.message}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">
              Informasi profil Anda digunakan untuk identitas penulis.
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
