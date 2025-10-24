import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { siteConfigSchema } from "@/lib/validators/config";
import { writeAuditLog } from "@/lib/audit/log";

const GENERAL_KEY = "general";

export async function GET() {
  await assertRole(["EDITOR", "ADMIN"]);

  const config = await prisma.siteConfig.findUnique({ where: { key: GENERAL_KEY } });
  return NextResponse.json({
    data: {
      key: GENERAL_KEY,
      value: config?.value ?? {},
      updatedAt: config?.updatedAt ?? null,
    },
  });
}

export async function PUT(request: NextRequest) {
  await assertRole(["EDITOR", "ADMIN"]);

  const payload = await request.json().catch(() => null);
  const parsed = siteConfigSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Konfigurasi tidak valid" },
      { status: 422 }
    );
  }

  const config = await prisma.siteConfig.upsert({
    where: { key: GENERAL_KEY },
    update: { value: parsed.data },
    create: { key: GENERAL_KEY, value: parsed.data },
  });

  await writeAuditLog({
    action: "CONFIG_UPDATE",
    entity: "SiteConfig",
    entityId: config.id,
    metadata: parsed.data,
  });

  revalidateTag("site-config");
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  revalidatePath("/login/2fa");
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");

  return NextResponse.json({
    data: {
      key: GENERAL_KEY,
      value: config.value,
      updatedAt: config.updatedAt,
    },
  });
}
