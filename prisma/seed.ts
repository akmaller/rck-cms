import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { ArticleStatus, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function resolveSeedPassword() {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 12) {
    return { plain: fromEnv, generated: false };
  }

  const generated = randomBytes(16).toString("base64url");
  console.warn(
    `[seed] Generated temporary admin password. Store it securely and rotate immediately: ${generated}`
  );
  return { plain: generated, generated: true };
}

async function main() {
  const { plain: adminPasswordPlain } = await resolveSeedPassword();
  const adminPasswordHash = await bcrypt.hash(adminPasswordPlain, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@roemahcita.local" },
    update: {},
    create: {
      email: "admin@roemahcita.local",
      name: "Administrator",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      bio: "Pengelola utama Roemah Cita CMS.",
      emailVerified: new Date(),
      canPublish: true,
    },
  });

  await prisma.category.createMany({
    data: [
      { name: "Budaya", slug: "budaya", description: "Berita dan cerita budaya lokal." },
      { name: "Kuliner", slug: "kuliner", description: "Kreasi kuliner dan resep khas." },
      { name: "Komunitas", slug: "komunitas", description: "Aktivitas komunitas Roemah Cita." }
    ],
    skipDuplicates: true,
  });

  await prisma.tag.createMany({
    data: [
      { name: "Highlight", slug: "highlight" },
      { name: "Event", slug: "event" },
      { name: "Karya", slug: "karya" }
    ],
    skipDuplicates: true,
  });

  await prisma.siteConfig.upsert({
    where: { key: "general" },
    update: {
      value: {
        logoUrl: "/logo.svg",
        iconUrl: "/favicon.ico",
        tagline: "Merawat cita lokal, satu cerita dalam satu waktu",
        siteName: "Roemah Cita CMS",
        contactEmail: "admin@roemahcita.local",
        social: {
          facebook: "https://facebook.com/roemahcita",
          instagram: "https://instagram.com/roemahcita",
        },
        metadata: {
          title: "Roemah Cita CMS",
          description: "Content management system untuk mengelola artikel dan media Roemah Cita.",
          keywords: ["roemah cita", "cms", "konten"],
        },
        comments: {
          enabled: true,
        },
      },
    },
    create: {
      key: "general",
      value: {
        logoUrl: "/logo.svg",
        iconUrl: "/favicon.ico",
        tagline: "Merawat cita lokal, satu cerita dalam satu waktu",
        siteName: "Roemah Cita CMS",
        contactEmail: "admin@roemahcita.local",
        social: {
          facebook: "https://facebook.com/roemahcita",
          instagram: "https://instagram.com/roemahcita",
        },
        metadata: {
          title: "Roemah Cita CMS",
          description: "Content management system untuk mengelola artikel dan media Roemah Cita.",
          keywords: ["roemah cita", "cms", "konten"],
        },
        comments: {
          enabled: true,
        },
      },
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { menu: "main", title: "Beranda", url: "/", order: 0 },
      { menu: "main", title: "Artikel", url: "/articles", order: 1 },
      { menu: "main", title: "Tentang", url: "/about", order: 2 },
      { menu: "footer", title: "Hubungi Kami", url: "/contact", order: 0 }
    ],
    skipDuplicates: true,
  });

  const article = await prisma.article.upsert({
    where: { slug: "selamat-datang-di-roemah-cita" },
    update: {},
    create: {
      title: "Selamat Datang di Roemah Cita",
      slug: "selamat-datang-di-roemah-cita",
      excerpt: "Perkenalan singkat mengenai platform kreatif Roemah Cita.",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Ini adalah artikel pembuka untuk Roemah Cita CMS."
              }
            ]
          }
        ]
      },
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: adminUser.id,
    },
  });

  const [budayaCategory, highlightTag] = await Promise.all([
    prisma.category.findUnique({ where: { slug: "budaya" } }),
    prisma.tag.findUnique({ where: { slug: "highlight" } }),
  ]);

  if (!budayaCategory || !highlightTag) {
    throw new Error("Kategori atau tag awal tidak ditemukan setelah proses seeding.");
  }

  await prisma.articleCategory.upsert({
    where: {
      articleId_categoryId: {
        articleId: article.id,
        categoryId: budayaCategory.id,
      },
    },
    update: {},
    create: {
      articleId: article.id,
      categoryId: budayaCategory.id,
    },
  });

  await prisma.articleTag.upsert({
    where: {
      articleId_tagId: {
        articleId: article.id,
        tagId: highlightTag.id,
      },
    },
    update: {},
    create: {
      articleId: article.id,
      tagId: highlightTag.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "SEED",
      entity: "Article",
      entityId: article.id,
      userId: adminUser.id,
      metadata: {
        message: "Artikel pembuka berhasil dibuat selama proses seeding.",
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed gagal:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
