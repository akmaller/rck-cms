import Link from "next/link";

import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import type { RoleKey } from "@/lib/auth/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/lib/button-variants";
import { AuditLogList } from "./_components/audit-log-list";

type RangeOption = "week" | "month" | "custom";

const PAGE_SIZE = 20;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * DAY_IN_MS);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatDateLabel(date?: Date) {
  if (!date) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    range?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;

  if (!session?.user || role !== "ADMIN") {
    return <DashboardUnauthorized description="Log aktivitas hanya tersedia untuk Administrator." />;
  }

  const now = new Date();
  const rawRange = (searchParams.range ?? "week") as RangeOption;
  const range: RangeOption = ["week", "month", "custom"].includes(rawRange)
    ? rawRange
    : "week";

  const customFrom = parseDate(searchParams.from);
  const customTo = parseDate(searchParams.to);

  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (range === "week") {
    fromDate = subtractDays(now, 7);
    toDate = now;
  } else if (range === "month") {
    fromDate = subtractDays(now, 30);
    toDate = now;
  } else {
    fromDate = customFrom;
    toDate = customTo ? addDays(customTo, 1) : undefined;
  }

  const where: Prisma.AuditLogWhereInput = {
    createdAt:
      fromDate || toDate
        ? {
            gte: fromDate,
            lte: toDate,
          }
        : undefined,
  };

  const currentPage = Math.max(1, Number(searchParams.page ?? 1));

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const displayFrom = range === "custom" ? customFrom : fromDate;
  const displayTo = range === "custom" ? customTo : toDate;

  const baseParams = new URLSearchParams();
  baseParams.set("range", range);
  if (range === "custom") {
    if (searchParams.from) baseParams.set("from", searchParams.from);
    if (searchParams.to) baseParams.set("to", searchParams.to);
  }

  const prevParams = new URLSearchParams(baseParams);
  prevParams.set("page", String(currentPage - 1));
  const nextParams = new URLSearchParams(baseParams);
  nextParams.set("page", String(currentPage + 1));

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Log Aktivitas"
        description="Pantau aktivitas sistem untuk audit dan investigasi keamanan."
      />

      <Card>
        <CardHeader>
          <CardTitle>Rentang Waktu</CardTitle>
          <CardDescription>
            Secara default sistem menampilkan log 7 hari terakhir (20 entri per halaman).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/dashboard/audit-log" method="get" className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="range">Pilih rentang</Label>
              <select
                id="range"
                name="range"
                defaultValue={range}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="week">7 hari terakhir</option>
                <option value="month">30 hari terakhir</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Dari tanggal</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={range === "custom" ? searchParams.from ?? "" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Sampai tanggal</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={range === "custom" ? searchParams.to ?? "" : ""}
              />
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
          <p className="mt-4 text-xs text-muted-foreground">
            Rentang aktif: {formatDateLabel(displayFrom)} – {formatDateLabel(displayTo)}.
            {range === "custom"
              ? " Isi tanggal untuk menampilkan rentang khusus."
              : " Ubah ke custom untuk melihat periode lainnya."}
          </p>
        </CardContent>
      </Card>

      <AuditLogList
        logs={logs.map((log) => ({
          id: log.id,
          createdAt: log.createdAt.toISOString(),
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          metadata: log.metadata,
          userName: log.user?.name ?? log.user?.email ?? "Sistem",
          userEmail: log.user?.email ?? null,
        }))}
        total={total}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Halaman {currentPage} dari {totalPages}. Gunakan navigasi untuk melihat entri lainnya.
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={currentPage <= 1}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: currentPage <= 1 ? "pointer-events-none opacity-50" : undefined,
            })}
            href={`/dashboard/audit-log?${prevParams.toString()}`}
          >
            Sebelumnya
          </Link>
          <Link
            aria-disabled={currentPage >= totalPages}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: currentPage >= totalPages ? "pointer-events-none opacity-50" : undefined,
            })}
            href={`/dashboard/audit-log?${nextParams.toString()}`}
          >
            Berikutnya
          </Link>
        </div>
      </div>
    </div>
  );
}
