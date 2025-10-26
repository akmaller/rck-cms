import { ArticleStatus } from "@prisma/client";

import { auth } from "@/auth";
import { ConfigForm, type ConfigValues } from "@/components/forms/config-form";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { buildInitialConfig } from "../utils";

export const runtime = "nodejs";

export default async function ContentSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized description="Hanya Administrator yang dapat mengubah konfigurasi konten." />
    );
  }

  const configRecord = await prisma.siteConfig.findUnique({ where: { key: "general" } });
  const value = (configRecord?.value ?? {}) as ConfigValues;
  const initialConfig = buildInitialConfig(value);
  let currentPolicySlug: string | null = null;
  if (typeof value?.registration?.privacyPolicyPageSlug === "string") {
    const trimmed = value.registration.privacyPolicyPageSlug.trim();
    if (trimmed.length > 0) {
      currentPolicySlug = trimmed;
    }
  }

  const publishedPages = await prisma.page.findMany({
    where: { status: ArticleStatus.PUBLISHED },
    orderBy: { title: "asc" },
    select: {
      slug: true,
      title: true,
    },
  });

  const basePolicyOptions = publishedPages.map((page) => ({
    value: page.slug,
    label: page.title,
  }));

  let selectedPolicyOption: { value: string; label: string } | null = null;
  if (currentPolicySlug && !basePolicyOptions.some((option) => option.value === currentPolicySlug)) {
    const selectedPage = await prisma.page.findUnique({
      where: { slug: currentPolicySlug },
      select: {
        slug: true,
        title: true,
        status: true,
      },
    });
    if (selectedPage) {
      const statusLabel =
        selectedPage.status === ArticleStatus.PUBLISHED ? "Dipublikasikan" : "Belum dipublikasikan";
      selectedPolicyOption = {
        value: selectedPage.slug,
        label: `${selectedPage.title} (${statusLabel})`,
      };
    } else {
      selectedPolicyOption = {
        value: currentPolicySlug,
        label: `${currentPolicySlug} (halaman tidak ditemukan)`,
      };
    }
  }

  const policyPageOptions = selectedPolicyOption
    ? [selectedPolicyOption, ...basePolicyOptions]
    : basePolicyOptions;

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Konten & Partisipasi"
        description="Atur metadata SEO, registrasi penulis, dan modul komentar publik."
      />
      <ConfigForm
        initialConfig={initialConfig}
        sections={["metadata", "registration", "comments"]}
        heading="Preferensi Konten Publik"
        description="Sesuaikan metadata bawaan, aturan pendaftaran penulis, dan pengelolaan komentar."
        policyPageOptions={policyPageOptions}
      />
    </div>
  );
}
