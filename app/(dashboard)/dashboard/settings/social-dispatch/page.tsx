import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoleKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

import { retrySocialPostJobAction, runSocialDispatchNowAction } from "./actions";

export const runtime = "nodejs";

type JobRow = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "TWITTER";
  articleId: string;
  status: "PENDING" | "PROCESSING" | "POSTED" | "FAILED";
  retryCount: number;
  error: string | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  articleTitle: string | null;
  articleSlug: string | null;
};

function statusVariant(status: JobRow["status"]): "default" | "secondary" | "outline" {
  if (status === "POSTED") {
    return "default";
  }
  if (status === "FAILED") {
    return "outline";
  }
  if (status === "PROCESSING") {
    return "secondary";
  }
  return "outline";
}

function statusClassName(status: JobRow["status"]) {
  if (status === "FAILED") {
    return "border-destructive/40 text-destructive";
  }
  return undefined;
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function SocialDispatchSettingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;

  if (!session?.user || role !== "ADMIN") {
    return <DashboardUnauthorized description="Hanya Administrator yang dapat memantau antrian auto-post sosial." />;
  }

  const jobs = await prisma.$queryRaw<JobRow[]>`
    SELECT
      j."id",
      j."platform",
      j."articleId",
      j."status",
      j."retryCount",
      j."error",
      j."postedAt",
      j."createdAt",
      j."updatedAt",
      a."title" AS "articleTitle",
      a."slug" AS "articleSlug"
    FROM "SocialPostJob" j
    LEFT JOIN "Article" a ON a."id" = j."articleId"
    ORDER BY j."createdAt" DESC
    LIMIT 150
  `;

  const pendingCount = jobs.filter((job) => job.status === "PENDING").length;
  const failedCount = jobs.filter((job) => job.status === "FAILED").length;
  const postedCount = jobs.filter((job) => job.status === "POSTED").length;

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Antrian Auto-Post Sosial"
        description="Pantau job auto-post ke Facebook, Instagram, dan X, termasuk status gagal dan retry manual."
      />

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Queue</CardTitle>
          <CardDescription>
            Pending: {pendingCount} • Failed: {failedCount} • Posted: {postedCount}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={runSocialDispatchNowAction}>
            <Button type="submit">Jalankan Dispatch Sekarang</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Job</CardTitle>
          <CardDescription>Maksimal 150 job terbaru dari tabel `SocialPostJob`.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">Artikel</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Retry</th>
                  <th className="px-3 py-2 font-medium">Error</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Belum ada job antrian sosial.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border/40 align-top">
                      <td className="px-3 py-2 font-medium">{job.platform}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{job.articleTitle ?? "(Artikel dihapus)"}</div>
                        <div className="text-xs text-muted-foreground">{job.articleSlug ?? job.articleId}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(job.status)} className={statusClassName(job.status)}>
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{job.retryCount}</td>
                      <td className="max-w-[360px] px-3 py-2 text-xs text-muted-foreground">
                        {job.error ? <pre className="whitespace-pre-wrap">{job.error}</pre> : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>Updated: {formatDateTime(job.updatedAt)}</div>
                        <div>Posted: {formatDateTime(job.postedAt)}</div>
                      </td>
                      <td className="px-3 py-2">
                        {job.status === "FAILED" ? (
                          <form action={retrySocialPostJobAction}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Retry
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
