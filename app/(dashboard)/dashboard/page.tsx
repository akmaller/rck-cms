import Link from "next/link";

import { CommentStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/auth/permissions";

type VisitTrendPoint = {
  label: string;
  fullLabel: string;
  value: number;
};

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildLinePoints(values: number[], width = 120, height = 60) {
  if (values.length === 0) {
    return { line: "", area: "", coordinates: [] as Array<{ x: number; y: number }> };
  }

  const paddingX = 6;
  const paddingTop = 8;
  const paddingBottom = 10;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...values, 1);
  const baseline = height - paddingBottom;

  const coordinates = values.map((value, index) => {
    const ratio = values.length > 1 ? index / (values.length - 1) : 0.5;
    const x = paddingX + chartWidth * ratio;
    const normalized = maxValue === 0 ? 0 : value / maxValue;
    const y = baseline - chartHeight * normalized;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    `${coordinates[0]?.x ?? paddingX},${baseline}`,
    ...coordinates.map((point) => `${point.x},${point.y}`),
    `${coordinates[coordinates.length - 1]?.x ?? paddingX},${baseline}`,
  ];

  return {
    line,
    area: areaPoints.join(" "),
    coordinates,
  };
}

const quickActions: Array<{
  title: string;
  description: string;
  action: string;
  href: string;
  roles: RoleKey[];
}> = [
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
  let authorAccount: { emailVerified?: Date | null; canPublish?: boolean } | null = null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalArticles = 0;
  let articleThisMonth = 0;
  let articlePaths: string[] = [];
  let articleIds: string[] = [];

  if (role === "AUTHOR" && session?.user?.id) {
    const [countAll, countThisMonth, slugRows, authorRecord] = await Promise.all([
      prisma.article.count({ where: { authorId: session.user.id } }),
      prisma.article.count({ where: { authorId: session.user.id, createdAt: { gte: startOfMonth } } }),
      prisma.article.findMany({ where: { authorId: session.user.id }, select: { id: true, slug: true } }),
      prisma.user.findUnique({
        where: { id: session.user.id },
      }),
    ]);
    totalArticles = countAll;
    articleThisMonth = countThisMonth;
    articlePaths = slugRows.map((row) => `/articles/${row.slug}`);
    articleIds = slugRows.map((row) => row.id);
    authorAccount = authorRecord;
  } else if (role === "AUTHOR") {
    totalArticles = 0;
    articleThisMonth = 0;
    articlePaths = [];
    articleIds = [];
    if (session?.user?.id) {
      authorAccount = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
    }
  } else {
    const [countAll, countThisMonth] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);
    totalArticles = countAll;
    articleThisMonth = countThisMonth;
  }

  let visitsThisMonth = 0;
  let commentsThisMonth = 0;
  if (role !== "AUTHOR" || articlePaths.length > 0) {
    try {
      const visitWhere: Prisma.VisitLogWhereInput = { createdAt: { gte: startOfMonth } };
      if (role === "AUTHOR") {
        visitWhere.path = { in: articlePaths };
      }
      const uniqueMonthlyVisits = await prisma.visitLog.findMany({
        where: visitWhere,
        select: { path: true, ip: true },
        distinct: ["path", "ip"],
      });
      visitsThisMonth = uniqueMonthlyVisits.length;
    } catch {
      visitsThisMonth = 0;
    }
  }
  try {
    const commentDelegate = (prisma as unknown as { comment?: { count: typeof prisma.comment.count } }).comment;
    const statusLiteral = Prisma.raw(`'${CommentStatus.PUBLISHED}'::"CommentStatus"`);

    if (role === "AUTHOR") {
      if (articleIds.length === 0) {
        commentsThisMonth = 0;
      } else if (commentDelegate?.count) {
        commentsThisMonth = await commentDelegate.count({
          where: {
            articleId: { in: articleIds },
            status: CommentStatus.PUBLISHED,
            createdAt: { gte: startOfMonth },
          },
        });
      } else {
        const idList = Prisma.join(articleIds.map((id) => Prisma.sql`${id}`));
        const rawCount = await prisma.$queryRaw<Array<{ total: bigint }>>(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS total
            FROM "Comment"
            WHERE "articleId" IN (${idList})
              AND "status" = ${statusLiteral}
              AND "createdAt" >= ${startOfMonth}
          `
        );
        commentsThisMonth = Number(rawCount[0]?.total ?? 0);
      }
    } else if (commentDelegate?.count) {
      commentsThisMonth = await commentDelegate.count({
        where: {
          status: CommentStatus.PUBLISHED,
          createdAt: { gte: startOfMonth },
        },
      });
    } else {
      const rawCount = await prisma.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS total
          FROM "Comment"
          WHERE "status" = ${statusLiteral}
            AND "createdAt" >= ${startOfMonth}
        `
      );
      commentsThisMonth = Number(rawCount[0]?.total ?? 0);
    }
  } catch {
    commentsThisMonth = 0;
  }

  const sevenDayStart = new Date(now);
  sevenDayStart.setHours(0, 0, 0, 0);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);
  const baseDates = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(sevenDayStart);
    date.setDate(sevenDayStart.getDate() + index);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  let visitTrend: VisitTrendPoint[] = baseDates.map((date) => ({
    label: date.toLocaleDateString("id-ID", { weekday: "short" }),
    fullLabel: date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
    }),
    value: 0,
  }));

  if (role !== "AUTHOR" || articlePaths.length > 0) {
    try {
      const visitWhere: Prisma.VisitLogWhereInput = { createdAt: { gte: sevenDayStart } };
      if (role === "AUTHOR") {
        visitWhere.path = { in: articlePaths };
      }
      const visitLogs = await prisma.visitLog.findMany({
        where: visitWhere,
        select: { createdAt: true },
      });

      const dailyCounts = new Map<string, number>();
      for (const log of visitLogs) {
        const entryDate = new Date(log.createdAt);
        entryDate.setHours(0, 0, 0, 0);
        const key = formatDayKey(entryDate);
        dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
      }

      visitTrend = baseDates.map((date) => ({
        label: date.toLocaleDateString("id-ID", { weekday: "short" }),
        fullLabel: date.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
        value: dailyCounts.get(formatDayKey(date)) ?? 0,
      }));
    } catch {
      // ignore errors when fetching visit trend
    }
  }

  const visitTrendValues = visitTrend.map((point) => point.value);
  const visitTrendLine = buildLinePoints(visitTrendValues);
  const visitTrendTotal = visitTrendValues.reduce((sum, value) => sum + value, 0);
  const visitTrendPeak = Math.max(...visitTrendValues, 0);
  const visitTrendHasEntries = visitTrendValues.some((value) => value > 0);

  type RecentLog = Prisma.AuditLogGetPayload<{
    include: {
      user: { select: { name: true; role: true } };
    };
  }>;
  const recentLogs: RecentLog[] = await (async () => {
    if (canViewAuditSummary) {
      return prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          user: { select: { name: true, role: true } },
        },
      });
    }

    if (role === "AUTHOR" && session?.user?.id) {
      return prisma.auditLog.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true, role: true } },
        },
      });
    }

    return [];
  })();

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
      value: visitsThisMonth,
      caption: "Kombinasi unik path & IP pengunjung",
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
      {role === "AUTHOR" ? (
        (() => {
          const isVerified = Boolean(authorAccount?.emailVerified);
          const canPublishContent = Boolean(authorAccount?.canPublish ?? false) && isVerified;
          const badgeConfig = isVerified
            ? canPublishContent
              ? {
                  label: "Siap Menerbitkan",
                  badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
                  title: "Akun penulis Anda telah diverifikasi dan dapat memublikasikan artikel.",
                  message:
                    "Silakan gunakan menu artikel untuk menulis dan memublikasikan karya Anda secara mandiri.",
                }
              : {
                  label: "Menunggu Persetujuan Publikasi",
                  badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
                  title: "Akun Anda aktif, namun izin publikasi masih menunggu persetujuan admin.",
                  message:
                    "Anda dapat menulis dan menyimpan draft. Hubungi admin bila perlu mempercepat persetujuan.",
                }
            : {
                label: "Belum Diverifikasi",
                badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
                title: "Akun Anda belum diverifikasi.",
                message:
                  "Cek email Anda untuk menyelesaikan verifikasi. Selama belum diverifikasi, artikel tidak dapat dipublikasikan.",
              };

          return (
            <Card className="border-border/70 bg-muted/20">
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={badgeConfig.badgeClass} variant="outline">
                    {badgeConfig.label}
                  </Badge>
                  <p className="text-sm font-medium text-foreground">{badgeConfig.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{badgeConfig.message}</p>
              </CardContent>
            </Card>
          );
        })()
      ) : null}
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
      {role !== "AUTHOR" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {visibleActions.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Akses Terbatas</CardTitle>
                <CardDescription>
                  Hubungi administrator jika membutuhkan akses tambahan.
                </CardDescription>
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
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle>Tren Kunjungan 7 Hari Terakhir</CardTitle>
            <CardDescription>Data agregat dari tabel visit log.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-40 w-full text-primary">
              {visitTrendLine.line ? (
                <svg
                  viewBox="0 0 120 60"
                  className="h-full w-full"
                  role="img"
                  aria-label="Grafik garis kunjungan mingguan"
                >
                  <line
                    x1="6"
                    y1="50"
                    x2="114"
                    y2="50"
                    stroke="currentColor"
                    strokeOpacity="0.15"
                    strokeWidth="0.6"
                  />
                  <polyline
                    points={visitTrendLine.area}
                    fill="currentColor"
                    fillOpacity="0.12"
                    stroke="none"
                  />
                  <polyline
                    points={visitTrendLine.line}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {visitTrendLine.coordinates.map((point, index) => (
                    <circle key={index} cx={point.x} cy={point.y} r="1.8" fill="currentColor" />
                  ))}
                </svg>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Data kunjungan belum tersedia.
                </div>
              )}
            </div>
            <div className="flex items-start justify-between gap-2 px-[5%] text-center text-xs text-muted-foreground">
              {visitTrend.map((point) => (
                <div
                  key={point.fullLabel}
                  className="flex w-full max-w-[64px] flex-col items-center gap-1 rounded-md border border-border/60 bg-muted/10 p-2"
                  title={point.fullLabel}
                >
                  <p className="font-medium uppercase tracking-wide text-[11px]">
                    {point.label}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{point.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Total mingguan:
                <strong className="ml-1 text-foreground">
                  {visitTrendTotal.toLocaleString("id-ID")}
                </strong>
              </span>
              <span>
                Puncak harian:
                <strong className="ml-1 text-foreground">
                  {visitTrendPeak.toLocaleString("id-ID")}
                </strong>
              </span>
            </div>
            {!visitTrendHasEntries ? (
              <p className="text-xs text-muted-foreground">
                Belum ada kunjungan tercatat dalam tujuh hari terakhir.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {canViewAuditSummary ? "Aktivitas Terbaru" : "Aktivitas Anda"}
            </CardTitle>
            <CardDescription>
              {canViewAuditSummary
                ? "Ringkasan audit log."
                : "Jejak tindakan yang Anda lakukan di dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-60 space-y-2 overflow-y-auto pr-1 text-sm text-muted-foreground">
            {recentLogs.length === 0 ? (
              <p>Tidak ada aktivitas tercatat.</p>
            ) : (
              recentLogs.map((log) => (
                <p key={log.id}>
                  {canViewAuditSummary ? (
                    <>
                      {log.user?.name ?? "Sistem"}
                      <span className="text-muted-foreground"> {formatLogMessage(log)}</span>
                    </>
                  ) : (
                    formatLogMessage(log)
                  )}
                </p>
              ))
            )}
          </CardContent>
          {canViewAuditSummary ? (
            <div className="border-t border-border/80 px-6 py-3 text-right text-sm">
              <Link href="/dashboard/audit-log" className="font-semibold text-primary hover:underline">
                Lihat selengkapnya
              </Link>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
