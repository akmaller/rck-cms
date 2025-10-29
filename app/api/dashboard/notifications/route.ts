import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markNotificationsAsRead,
} from "@/lib/notifications/service";

const markSchema = z.object({
  ids: z.array(z.string().cuid()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 10;
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

  const { notifications, unreadCount, nextCursor } = await getUserNotifications(session.user.id, {
    limit,
    cursor,
  });

  return NextResponse.json({
    data: notifications.map((item) => ({
      id: item.id,
      type: item.type,
      articleId: item.articleId,
      commentId: item.commentId,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt ? item.readAt.toISOString() : null,
      actor: item.actor,
      article: item.article,
      comment: item.comment,
    })),
    unreadCount,
    nextCursor,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = markSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid." },
      { status: 422 }
    );
  }

  await markNotificationsAsRead(session.user.id, parsed.data.ids);
  const unreadCount = await getUnreadNotificationCount(session.user.id);

  return NextResponse.json({ success: true, unreadCount });
}
