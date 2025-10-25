import { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { DashboardUnauthorized } from "@/components/layout/dashboard/dashboard-unauthorized";
import { MediaManager, type MediaManagerItem } from "@/components/media/media-manager";
import { prisma } from "@/lib/prisma";
import { deriveThumbnailUrl } from "@/lib/storage/media";

const DEFAULT_PER_PAGE = 20;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  uploadedBy: z.union([z.literal("all"), z.literal("me"), z.string().cuid()]).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

type MediaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const session = await auth();
  if (!session?.user) {
    return <DashboardUnauthorized />;
  }

  const role = session.user.role ?? "AUTHOR";
  const isAuthor = role === "AUTHOR";
  if (!(role === "ADMIN" || role === "EDITOR" || isAuthor)) {
    return (
      <DashboardUnauthorized description="Anda tidak memiliki akses ke manajer media." />
    );
  }

  const resolvedParams = await searchParams;
  const flattenedParams = Object.fromEntries(
    Object.entries(resolvedParams ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );

  const parsedQuery = querySchema.safeParse(flattenedParams);
  const query = parsedQuery.success
    ? parsedQuery.data
    : { page: 1, search: undefined, uploadedBy: undefined, dateFrom: undefined, dateTo: undefined };

  const perPage = DEFAULT_PER_PAGE;
  const searchTerm = query.search?.trim() ?? "";

  const filters: Prisma.MediaWhereInput[] = [
    { NOT: { fileName: { startsWith: "album/" } } },
  ];

  if (searchTerm.length > 0) {
    filters.push({
      OR: [
        { title: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { fileName: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  const uploadedByRaw = query.uploadedBy ?? "me";
  const uploadedBy =
    uploadedByRaw === "me" || uploadedByRaw === "all" ? uploadedByRaw : uploadedByRaw ?? "me";

  if (isAuthor) {
    filters.push({ createdById: session.user.id });
  } else if (uploadedBy === "me") {
    filters.push({ createdById: session.user.id });
  } else if (uploadedBy !== "all") {
    filters.push({ createdById: uploadedBy });
  }

  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
  const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
  if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
    filters.push({ createdAt: { gte: dateFrom } });
  }
  if (dateTo && !Number.isNaN(dateTo.getTime())) {
    dateTo.setUTCHours(23, 59, 59, 999);
    filters.push({ createdAt: { lte: dateTo } });
  }

  const where = filters.length === 1 ? filters[0] : { AND: filters };

  const [total, uploaderRecords] = await Promise.all([
    prisma.media.count({ where }),
    isAuthor
      ? Promise.resolve([
          {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email ?? null,
          },
        ])
      : prisma.user.findMany({
          where: {
            media: {
              some: {
                NOT: { fileName: { startsWith: "album/" } },
              },
            },
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  const currentPage = totalPages > 0 ? Math.min(query.page, totalPages) : 1;
  const skip = Math.max(0, (currentPage - 1) * perPage);

  const media = await prisma.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: perPage,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const initialItems: MediaManagerItem[] = media.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    thumbnailUrl: deriveThumbnailUrl(item.url) ?? undefined,
    mimeType: item.mimeType,
    size: item.size,
    width: item.width,
    height: item.height,
    createdAt: item.createdAt.toISOString(),
    fileName: item.fileName,
    createdBy: item.createdBy
      ? {
          id: item.createdBy.id,
          name: item.createdBy.name,
          email: item.createdBy.email,
        }
      : null,
  }));

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Media"
        description="Kelola file unggahan yang digunakan dalam artikel, halaman, atau galeri."
      />
      <MediaManager
        initialItems={initialItems}
        initialMeta={{
          page: currentPage,
          perPage,
          total,
          totalPages,
          filters: {
            uploadedBy: isAuthor
              ? "me"
              : uploadedBy === session.user.id
                ? "me"
                : uploadedBy,
            dateFrom: query.dateFrom ?? null,
            dateTo: query.dateTo ?? null,
          },
        }}
        initialSearch={searchTerm}
        uploaderOptions={uploaderRecords}
        currentUserId={session.user.id}
        canViewAllUsers={!isAuthor}
      />
    </div>
  );
}
