import Link from "next/link";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/lib/button-variants";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    entity?: string;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
    return null;
  }

  const currentPage = Math.max(1, Number(searchParams.page ?? 1));
  const { entity, action, userId, from, to } = searchParams;

  const where: Prisma.AuditLogWhereInput = {
    entity: entity?.trim() ? entity : undefined,
    action: action?.trim() ? action : undefined,
    userId: userId?.trim() ? userId : undefined,
    createdAt:
      from || to
        ? {
            gte: from ? new Date(from) : undefined,
            lte: to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000) : undefined,
          }
        : undefined,
  };

  const [logs, total, distinctActions, distinctEntities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseParams = new URLSearchParams({
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Audit Log"
        description="Riwayat perubahan data untuk keperluan keamanan dan monitoring."
      />
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Saring catatan aktivitas berdasarkan entitas, aksi, atau tanggal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" action="/dashboard/audit-log" method="get">
            <div className="space-y-2">
              <Label htmlFor="entity">Entitas</Label>
              <select
                id="entity"
                name="entity"
                defaultValue={entity ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Semua</option>
                {distinctEntities
                  .map((item) => item.entity)
                  .filter(Boolean)
                  .map((value) => (
                    <option key={value} value={value!}>
                      {value}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Aksi</Label>
              <select
                id="action"
                name="action"
                defaultValue={action ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Semua</option>
                {distinctActions
                  .map((item) => item.action)
                  .filter(Boolean)
                  .map((value) => (
                    <option key={value} value={value!}>
                      {value}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" name="userId" placeholder="Optional" defaultValue={userId ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Dari tanggal</Label>
              <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Sampai tanggal</Label>
              <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className={buttonVariants({})}>
                Terapkan
              </button>
              <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/audit-log">
                Reset
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Terbaru</CardTitle>
          <CardDescription>Menampilkan {logs.length} dari {total} catatan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{log.action}</Badge>
                <span className="font-medium">{log.entity}</span>
                <span className="text-muted-foreground">#{log.entityId}</span>
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {log.user ? `${log.user.name ?? log.user.email} (${log.user.email})` : "Sistem"}
              </div>
              {log.metadata ? (
                <pre className="overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas yang dicatat.</p>
          ) : null}
        </CardContent>
      </Card>
      {totalPages > 1 ? (
        <nav className="flex items-center gap-2" aria-label="Pagination">
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/dashboard/audit-log?${new URLSearchParams({ ...Object.fromEntries(baseParams.entries()), page: String(Math.max(1, currentPage - 1)) })}`}
          >
            Sebelumnya
          </Link>
          <span className="text-sm text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </span>
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/dashboard/audit-log?${new URLSearchParams({ ...Object.fromEntries(baseParams.entries()), page: String(Math.min(totalPages, currentPage + 1)) })}`}
          >
            Berikutnya
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
