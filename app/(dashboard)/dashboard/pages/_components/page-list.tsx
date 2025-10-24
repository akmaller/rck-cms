"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeletePageButton } from "./delete-page-button";

type PageListProps = {
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    updatedAt: string;
    createdAt: string;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "DRAFT":
      return "Draft";
    case "REVIEW":
      return "Review";
    case "SCHEDULED":
      return "Terjadwal";
    case "ARCHIVED":
      return "Arsip";
    default:
      return status;
  }
}

export function PageList({ pages }: PageListProps) {
  const hasPages = pages.length > 0;
  const firstHighlight = pages[0]?.id ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Halaman</CardTitle>
        <CardDescription>
          {hasPages ? `${pages.length} halaman tersedia.` : "Belum ada halaman statis yang dibuat."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasPages ? (
          pages.map((page) => (
            <div
              key={page.id}
              className={`flex flex-col gap-3 rounded-md border border-border/60 bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between ${
                page.id === firstHighlight ? "border-primary/60 bg-primary/5" : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{page.title}</p>
                  <Badge variant={page.status === "PUBLISHED" ? "default" : "secondary"}>
                    {formatStatus(page.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  /{page.slug} • Diperbarui {formatDate(page.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/pages/${page.id}/edit`}>Edit</Link>
                </Button>
                <DeletePageButton pageId={page.id} pageTitle={page.title} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Mulai dengan membuat halaman baru menggunakan tombol &ldquo;Tambah Halaman&rdquo; di atas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
