import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaGrid } from "@/components/media/media-grid";
import { deleteMedia } from "./actions";
import { UploadForm } from "@/app/(dashboard)/dashboard/media/upload-form";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

async function deleteMediaAction(formData: FormData) {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string") {
    return;
  }
  await deleteMedia(id);
}

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const media = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
  });

  const imageCount = media.filter((item) => item.mimeType.startsWith("image/")).length;

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Media"
        description="Kelola file unggahan yang digunakan dalam artikel, halaman, atau galeri."
      />
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Galeri</CardTitle>
            <CardDescription>{media.length} file ({imageCount} gambar).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Filter mendatang: gambar saja, video, atau semua media.</span>
            </div>
            <MediaGrid
              items={media.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                url: item.url,
                mimeType: item.mimeType,
                size: item.size,
                createdAt: item.createdAt,
              }))}
              onDelete={deleteMediaAction}
            />
          </CardContent>
        </Card>
        <UploadForm />
      </section>
    </div>
  );
}
