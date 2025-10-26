import Link from "next/link";

import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { UserForm } from "@/components/forms/user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import { buttonVariants } from "@/lib/button-variants";
import type { RoleKey } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

import { UserList } from "./user-list";

const PAGE_SIZE = 20;

const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  AUTHOR: "Author",
};

type UsersPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    role?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "AUTHOR") as RoleKey;
  if (!session?.user || role !== "ADMIN") {
    return (
      <DashboardUnauthorized
        description="Halaman ini hanya tersedia untuk Administrator."
      />
    );
  }

  const resolvedParams = await searchParams;
  const rawPage = Number(resolvedParams.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const query = (resolvedParams.q ?? "").trim();
  const rawRoleParam = resolvedParams.role;
  const normalizedRole = typeof rawRoleParam === "string" ? rawRoleParam.toUpperCase() : "";
  const allowedRoles: RoleKey[] = ["ADMIN", "EDITOR", "AUTHOR"];
  const selectedRole = allowedRoles.includes(normalizedRole as RoleKey)
    ? (normalizedRole as RoleKey)
    : null;

  const filters: Prisma.UserWhereInput[] = [];
  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }
  if (selectedRole) {
    filters.push({ role: selectedRole });
  }

  const where = filters.length > 0 ? { AND: filters } : undefined;

  const totalUsers = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const userEntries = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }));
  const totalEntries = totalUsers;
  const startItem = totalEntries === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = totalEntries === 0 ? 0 : startItem + userEntries.length - 1;

  const buildPageLink = (pageNumber: number) => {
    const params = new URLSearchParams();
    const targetPage = Math.min(Math.max(pageNumber, 1), totalPages);
    if (query) params.set("q", query);
    if (selectedRole) params.set("role", selectedRole);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/dashboard/users${qs ? `?${qs}` : ""}`;
  };

  const paginationButtonClass = buttonVariants({ variant: "outline", size: "sm" });
  const emptyMessage =
    query || selectedRole
      ? "Tidak ada pengguna yang cocok dengan pencarian atau filter."
      : "Belum ada pengguna.";

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Pengguna"
        description="Kelola akun pengguna dan perannya di CMS."
      />
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Pengguna</CardTitle>
            <CardDescription>
              {totalEntries === 0
                ? query || selectedRole
                  ? "Tidak ada pengguna yang cocok dengan pencarian atau filter."
                  : "Belum ada pengguna terdaftar."
                : `Menampilkan ${startItem}-${endItem} dari ${totalEntries} pengguna.`}
              {query ? ` Pencarian: “${query}”.` : ""}
              {selectedRole ? ` Filter peran: ${ROLE_LABELS[selectedRole]}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              method="get"
              action="/dashboard/users"
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="Cari nama atau email..."
                  className="sm:max-w-xs"
                />
                <select
                  name="role"
                  defaultValue={selectedRole ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-40"
                >
                  <option value="">Semua peran</option>
                  {allowedRoles.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {ROLE_LABELS[roleOption]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {query || selectedRole ? (
                  <Link
                    href="/dashboard/users"
                    className={cn(paginationButtonClass, "whitespace-nowrap")}
                  >
                    Reset
                  </Link>
                ) : null}
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Terapkan
                </button>
              </div>
            </form>
            <UserList
              users={userEntries}
              currentUserId={session.user.id}
              emptyMessage={emptyMessage}
            />
            {totalEntries > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Halaman {safePage} dari {totalPages}. Menampilkan {startItem}-{endItem}.
                </p>
                <div className="flex items-center gap-2">
                  {safePage > 1 ? (
                    <Link className={paginationButtonClass} href={buildPageLink(safePage - 1)}>
                      Sebelumnya
                    </Link>
                  ) : (
                    <span className={cn(paginationButtonClass, "pointer-events-none opacity-50")}>
                      Sebelumnya
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Halaman {safePage} / {totalPages}
                  </span>
                  {safePage < totalPages ? (
                    <Link className={paginationButtonClass} href={buildPageLink(safePage + 1)}>
                      Berikutnya
                    </Link>
                  ) : (
                    <span className={cn(paginationButtonClass, "pointer-events-none opacity-50")}>
                      Berikutnya
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <UserForm />
      </section>
    </div>
  );
}
