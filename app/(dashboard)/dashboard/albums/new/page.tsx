import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

import { AlbumCreateForm } from "../_components/album-create-form";

export default async function NewAlbumPage() {
  const session = await auth();
  const role = session?.user?.role ?? null;

  if (!session?.user) {
    redirect("/login");
  }

  if (role !== "ADMIN" && role !== "EDITOR") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Album Baru"
        description="Susun kumpulan gambar dan publikasikan sebagai album."
      />
      <AlbumCreateForm />
    </div>
  );
}
