import Link from "next/link";

import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/auth/permissions";

const quickActions: Array<{
  title: string;
  description: string;
  action: string;
  href: string;
  roles: RoleKey[];
}> = [
  {
    title: "Tulis Artikel Baru",
    description: "Gunakan editor Tiptap untuk merancang dan menjadwalkan publikasi.",
    action: "Buat Artikel",
    href: "/dashboard/articles/new",
    roles: ["ADMIN", "EDITOR", "AUTHOR"],
  },
  {
    title: "Kelola Media",
    description: "Unggah gambar, video, atau dokumen pendukung konten.",
    action: "Buka Media",
    href: "/dashboard/media",
    roles: ["ADMIN", "EDITOR"],
  },
  {
    title: "Pengaturan Situs",
    description: "Atur identitas brand, menu, dan konfigurasi SEO.",
    action: "Buka Pengaturan",
    href: "/dashboard/settings",
    roles: ["ADMIN"],
  },
];

export default async function DashboardHomePage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  const displayName = session?.user?.name ?? "Admin";
  const visibleActions = quickActions.filter((item) => item.roles.includes(role));
  const canViewAuditSummary = role !== "AUTHOR";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalArticles, articleThisMonth] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);

  let viewsThisMonth = 0;
  let commentsThisMonth = 0;
  try {
    viewsThisMonth = await prisma.auditLog.count({
      where: {
        action: "ARTICLE_VIEW",
        createdAt: { gte: startOfMonth },
      },
    });
  } catch {
    viewsThisMonth = 0;
  }
  try {
    commentsThisMonth = await prisma.auditLog.count({
      where: {
        action: "COMMENT_CREATE",
        createdAt: { gte: startOfMonth },
      },
    });
  } catch {
    commentsThisMonth = 0;
  }

  type RecentLog = Prisma.AuditLogGetPayload<{
    include: {
      user: { select: { name: true; role: true } };
    };
  }>;
  const recentLogs: RecentLog[] = canViewAuditSummary
    ? await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          user: { select: { name: true, role: true } },
        },
      })
    : [];

  const statsCards = [
    {
      title: "Total Artikel",
      value: totalArticles,
      caption: "Semua status",
    },
    {
      title: "Artikel Baru (bulan ini)",
      value: articleThisMonth,
      caption: startOfMonth.toLocaleString("id-ID", { month: "long", year: "numeric" }),
    },
    {
      title: "Kunjungan (bulan ini)",
      value: viewsThisMonth,
      caption: "Berdasarkan audit log",
    },
    {
      title: "Komentar (bulan ini)",
      value: commentsThisMonth,
      caption: commentsThisMonth === 0 ? "Segera tersedia setelah fitur aktif" : undefined,
    },
  ];

  const activityDescriptions: Record<string, string> = {
    ARTICLE_CREATE: "memublikasikan artikel baru",
    ARTICLE_UPDATE: "memperbarui artikel",
    ARTICLE_DELETE: "menghapus artikel",
    USER_CREATE: "menambahkan pengguna baru",
    USER_UPDATE: "memperbarui data pengguna",
    USER_DELETE: "menghapus pengguna",
    CATEGORY_CREATE: "membuat kategori baru",
    CATEGORY_UPDATE: "memperbarui kategori",
    CATEGORY_DELETE: "menghapus kategori",
    MENU_ITEM_CREATE: "menambahkan menu",
    MENU_ITEM_UPDATE: "memperbarui menu",
    MENU_ITEM_DELETE: "menghapus menu",
    ARTICLE_VIEW: "mencatat kunjungan artikel",
    COMMENT_CREATE: "menambahkan komentar baru",
  };

  const formatLogMessage = (log: RecentLog) => {
    const createdAt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
    const datePart = createdAt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timePart = createdAt.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const actor = log.user?.name ?? "Sistem";
    const actionDescription =
      activityDescriptions[log.action] ??
      `melakukan aksi ${log.action.toLowerCase().replace(/_/g, " ")}`;
    return `- ${datePart} [${timePart}] - ${actor} ${actionDescription}`;
  };

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading={`Selamat datang, ${displayName}`}
        description="Pantau aktivitas terbaru dan kelola konten dari satu tempat."
      />
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="border-border/80 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">
                {stat.value.toLocaleString("id-ID")}
              </p>
              {stat.caption ? (
                <p className="text-xs text-muted-foreground">{stat.caption}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {visibleActions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Akses Terbatas</CardTitle>
              <CardDescription>Hubungi administrator jika membutuhkan akses tambahan.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
        {visibleActions.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={item.href}>{item.action}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {canViewAuditSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terbaru</CardTitle>
            <CardDescription>Catatan dari audit log (maksimal 15 entri terbaru).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {recentLogs.length === 0 ? (
              <p>Tidak ada aktivitas tercatat.</p>
            ) : (
              recentLogs.map((log) => <p key={log.id}>{formatLogMessage(log)}</p>)
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
