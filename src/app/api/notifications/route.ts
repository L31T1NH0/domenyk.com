import { NextRequest, NextResponse } from "next/server"
import { adminOnly, getAuthUserId } from "@/lib/auth"
import { listNotifications, markAllNotificationsRead, markNotificationRead, serializeNotification, unreadNotificationCount } from "@/lib/db/notifications"

export async function GET() {
  const denied = await adminOnly()
  if (denied) return denied
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [items, unread] = await Promise.all([listNotifications(userId), unreadNotificationCount(userId)])
  return NextResponse.json({ items: items.map(serializeNotification), unread })
}

export async function PATCH(req: NextRequest) {
  const denied = await adminOnly()
  if (denied) return denied
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as { id?: unknown; all?: unknown } | null
  if (body?.all === true) await markAllNotificationsRead(userId)
  else if (typeof body?.id === "string") await markNotificationRead(body.id, userId)
  else return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  return NextResponse.json({ ok: true })
}
