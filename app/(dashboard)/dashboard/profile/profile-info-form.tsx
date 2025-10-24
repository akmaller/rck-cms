"use client";

import { useState, useTransition } from "react";

import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess } from "@/lib/notifications/client";

type ProfileInfoFormProps = {
  initialData: {
    name: string;
    email: string;
    bio: string | null;
  };
};

export function ProfileInfoForm({ initialData }: ProfileInfoFormProps) {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Profil</CardTitle>
        <CardDescription>Perbarui nama tampilan, email, dan bio singkat Anda.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const formData = new FormData(formElement);
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
