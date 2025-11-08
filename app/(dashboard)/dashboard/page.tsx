import Link from "next/link";

import { CommentStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { VisitTrendChart } from "@/components/analytics/visit-trend-chart";
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
import type { PopularArticle, VisitTrendPoint } from "@/types/analytics";

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function extractArticleSlug(path: string | null | undefined) {
  if (!path) {
    return null;
  }
  const normalized = path.replace(/\/+$/, "");
  if (!normalized.startsWith("/articles/")) {
    return null;
  }
  const slug = normalized.slice("/articles/".length);
  return slug.length > 0 ? slug : null;
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
  const visitTrendTotal = visitTrendValues.reduce((sum, value) => sum + value, 0);
  const visitTrendPeak = Math.max(...visitTrendValues, 0);
  const visitTrendHasEntries = visitTrendValues.some((value) => value > 0);

  const popularArticles: PopularArticle[] = await (async () => {
    if (role === "AUTHOR" && articlePaths.length === 0) {
      return [];
    }

    try {
      const visitWhere: Prisma.VisitLogWhereInput = { createdAt: { gte: sevenDayStart } };
      if (role === "AUTHOR") {
        visitWhere.path = { in: articlePaths };
      }

      const groupedVisits = await prisma.visitLog.groupBy({
        by: ["path"],
        where: visitWhere,
        _count: { _all: true },
        orderBy: { _count: { _all: "desc" } },
        take: 25,
      });

      if (groupedVisits.length === 0) {
        return [];
      }

      const slugCandidates = groupedVisits
        .map((entry) => extractArticleSlug(entry.path))
        .filter((slug): slug is string => Boolean(slug));

      if (slugCandidates.length === 0) {
        return [];
      }

      const uniqueSlugs = Array.from(new Set(slugCandidates)).slice(0, 25);
      const articleWhere: Prisma.ArticleWhereInput =
        role === "AUTHOR" && session?.user?.id
          ? { slug: { in: uniqueSlugs }, authorId: session.user.id }
          : { slug: { in: uniqueSlugs } };

      const articleRecords = await prisma.article.findMany({
        where: articleWhere,
        select: { slug: true, title: true },
      });

      const articleMap = new Map(articleRecords.map((article) => [article.slug, article]));

      const ranked: PopularArticle[] = [];
      for (const entry of groupedVisits) {
        const slug = extractArticleSlug(entry.path);
        if (!slug) {
          continue;
        }
        const article = articleMap.get(slug);
        if (!article) {
          continue;
        }
        ranked.push({
          slug,
          title: article.title,
          visits: entry._count._all,
        });
        if (ranked.length >= 10) {
          break;
        }
      }

      return ranked;
    } catch {
      return [];
    }
  })();

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
        <div className="space-y-4">
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle>Tren Kunjungan 7 Hari Terakhir</CardTitle>
              <CardDescription>Data agregat dari tabel visit log.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <VisitTrendChart data={visitTrend} />
              <div className="grid grid-cols-2 gap-2 px-1 text-center text-xs text-muted-foreground sm:grid-cols-4 lg:grid-cols-7">
                {visitTrend.map((point) => {
                  const isPeak = visitTrendPeak > 0 && point.value === visitTrendPeak;
                  return (
                    <div
                      key={point.fullLabel}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors ${
                        isPeak
                          ? "border-primary/70 bg-primary/10 text-foreground"
                          : "border-border/60 bg-muted/10"
                      }`}
                      title={point.fullLabel}
                    >
                      <p className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                        {point.label}
                      </p>
                      <p className="text-sm font-semibold text-foreground">{point.value}</p>
                    </div>
                  );
                })}
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
            <CardHeader>
              <CardTitle>Artikel Terpopuler Minggu Ini</CardTitle>
              <CardDescription>
                Berdasarkan jumlah kunjungan dalam tujuh hari terakhir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {popularArticles.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                  {visitTrendHasEntries
                    ? "Belum ada artikel yang menonjol dalam tujuh hari terakhir."
                    : "Data kunjungan belum tersedia untuk menghitung artikel populer."}
                </div>
              ) : (
                <ul className="space-y-3">
                  {popularArticles.map((article, index) => (
                    <li
                      key={article.slug}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2"
                    >
                      <div className="flex flex-1 items-start gap-3">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          #{index + 1}
                        </span>
                        <div className="flex flex-1 flex-col">
                          <Link
                            href={`/articles/${article.slug}`}
                            className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                          >
                            {article.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {article.visits.toLocaleString("id-ID")} kunjungan
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
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
