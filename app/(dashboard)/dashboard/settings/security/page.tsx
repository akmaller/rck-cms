import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { getSecurityPolicy, securityPolicyToFormValues } from "@/lib/security/policy";
import { getRecentSecurityIncidents } from "@/lib/security/activity-log";

import { SecurityPolicyForm } from "./_components/security-policy-form";
import { BlockedIpTable } from "./_components/blocked-ip-table";
import { SecurityIncidentTable } from "./_components/security-incident-table";

import { TwoFactorManager } from "./two-factor-manager";

export const runtime = "nodejs";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const isAdmin = (session.user.role ?? "") === "ADMIN";
  let securityPolicyFormDefaults: ReturnType<typeof securityPolicyToFormValues> | null = null;
  let blockedIps: Awaited<ReturnType<typeof prisma.blockedIp.findMany>> = [];
  let securityIncidents: Awaited<ReturnType<typeof getRecentSecurityIncidents>> = [];

  if (isAdmin) {
    const [policy, blocked, incidents] = await Promise.all([
      getSecurityPolicy(),
      prisma.blockedIp.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      getRecentSecurityIncidents(100),
    ]);
    securityPolicyFormDefaults = securityPolicyToFormValues(policy);
    blockedIps = blocked;
    securityIncidents = incidents;
  }

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Keamanan Akun"
        description="Atur autentikasi dua faktor dan pantau aktivitas akun Anda."
      />

      <Card>
        <CardHeader>
          <CardTitle>Autentikasi Dua Faktor (2FA)</CardTitle>
          <CardDescription>
            Gunakan aplikasi autentikator (Google Authenticator, Authy, dll.) untuk menambahkan lapisan keamanan tambahan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorManager email={user.email ?? ""} twoFactorEnabled={user.twoFactorEnabled} />
        </CardContent>
      </Card>

      {isAdmin && securityPolicyFormDefaults ? (
        <Card>
          <CardHeader>
            <CardTitle>Kebijakan Pembatasan</CardTitle>
            <CardDescription>
              Atur batas percobaan login, kunjungan halaman, dan permintaan API sebelum IP diblokir sementara.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SecurityPolicyForm defaults={securityPolicyFormDefaults} />
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Daftar IP Diblokir</CardTitle>
            <CardDescription>Kelola alamat IP yang saat ini diblokir oleh sistem keamanan.</CardDescription>
          </CardHeader>
          <CardContent>
            <BlockedIpTable entries={blockedIps.map((entry) => ({
              id: entry.id,
              ip: entry.ip,
              reason: entry.reason,
              category: entry.category,
              blockedUntil: entry.blockedUntil ? entry.blockedUntil.toISOString() : null,
              createdAt: entry.createdAt.toISOString(),
            }))} />
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Mencurigakan</CardTitle>
            <CardDescription>Log percobaan serangan atau aktivitas abnormal terbaru.</CardDescription>
          </CardHeader>
          <CardContent>
            <SecurityIncidentTable entries={securityIncidents.map((incident) => ({
              id: incident.id,
              category: incident.category,
              description: incident.description,
              ip: incident.ip,
              source: incident.source,
              metadata: incident.metadata,
              createdAt: incident.createdAt.toISOString(),
            }))} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
