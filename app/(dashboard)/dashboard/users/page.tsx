import { auth } from "@/auth";
import { UserForm } from "@/components/forms/user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun pengguna dan perannya di CMS.
          </p>
        </div>
      </div>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Pengguna</CardTitle>
            <CardDescription>Total {users.length} pengguna terdaftar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.email} • {user.role}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("id-ID")}
                </span>
              </div>
            ))}
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
            ) : null}
          </CardContent>
        </Card>
        <UserForm />
      </section>
    </div>
  );
}
