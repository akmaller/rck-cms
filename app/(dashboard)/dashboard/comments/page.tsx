import Link from "next/link";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

import { CommentsCard } from "./comments-card";
import { COMMENT_STATUS } from "./types";
import type { CommentListItem, CommentsView, CommentStatusValue } from "./types";
import type { RoleKey } from "@/lib/auth/permissions";

type CommentsSearchParams = {
  view?: string;
};

type CommentsPageProps = {
  searchParams: Promise<CommentsSearchParams>;
};

const DEFAULT_VIEW: CommentsView = "received";

const VIEW_CONFIG: Record<
  CommentsView,
  { label: string; description: string; emptyMessage: string }
> = {
  received: {
    label: "Komentar untuk Artikel Anda",
    description: "Pantau komentar yang diterima oleh artikel yang Anda tulis.",
    emptyMessage: "Belum ada komentar pada artikel Anda.",
  },
  authored: {
    label: "Komentar yang Anda Kirim",
    description: "Lihat riwayat komentar yang pernah Anda kirimkan ke artikel lain.",
    emptyMessage: "Anda belum pernah mengirim komentar.",
  },
  moderation: {
    label: "Moderasi",
    description: "Tinjau dan setujui komentar yang menunggu publikasi.",
    emptyMessage: "Tidak ada komentar yang menunggu moderasi.",
  },
};

function resolveView(param: string | undefined): CommentsView {
  if (param === "authored") {
    return "authored";
  }
  if (param === "moderation") {
    return "moderation";
  }
  if (param === "received") {
    return "received";
  }
  return DEFAULT_VIEW;
}

export default async function DashboardCommentsPage({ searchParams }: CommentsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = (session.user.role ?? "AUTHOR") as RoleKey;

  const resolvedParams = await searchParams;
  let activeView = resolveView(resolvedParams.view?.toLowerCase());
  if (activeView === "moderation" && role !== "ADMIN" && role !== "EDITOR") {
    activeView = DEFAULT_VIEW;
  }

  const where: Prisma.CommentWhereInput =
    activeView === "received"
      ? {
          article: { authorId: session.user.id },
        }
      : activeView === "moderation"
        ? {
            status: COMMENT_STATUS.PENDING,
          }
        : {
            userId: session.user.id,
          };

  const comments = await prisma.comment.findMany({
    where,
    orderBy: activeView === "moderation" ? { createdAt: "asc" } : { createdAt: "desc" },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          author: { select: { id: true, name: true } },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  const commentItems: CommentListItem[] = comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    status: comment.status as CommentStatusValue,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    articleTitle: comment.article?.title ?? "Artikel tidak ditemukan",
    articleSlug: comment.article?.slug ?? null,
    articleAuthorName: comment.article?.author?.name ?? null,
    commenterName: comment.user?.name ?? null,
    commenterAvatarUrl: comment.user?.avatarUrl ?? null,
    commenterId: comment.user?.id ?? null,
  }));

  const viewConfig = VIEW_CONFIG[activeView];
  const availableViews: CommentsView[] =
    role === "ADMIN" || role === "EDITOR"
      ? ["received", "authored", "moderation"]
      : ["received", "authored"];
  const buildViewHref = (targetView: CommentsView) => {
    if (targetView === DEFAULT_VIEW) {
      return "/dashboard/comments";
    }
    return `/dashboard/comments?view=${targetView}`;
  };

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading="Komentar"
        description="Kelola komentar yang masuk dan tinjau riwayat komentar yang pernah Anda kirim."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Komentar</h1>
          <p className="text-sm text-muted-foreground">
            {viewConfig.description}
          </p>
        </div>
        <nav
          aria-label="Tampilan komentar"
          className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-1"
        >
          {availableViews.map((view) => {
            const isActive = view === activeView;
            return (
              <Link
                key={view}
                href={buildViewHref(view)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {VIEW_CONFIG[view].label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Card>
        <CommentsCard
          comments={commentItems}
          view={activeView}
          emptyMessage={viewConfig.emptyMessage}
          currentRole={role}
          currentUserId={session.user.id}
        />
      </Card>
    </div>
  );
}
