import { NextResponse } from "next/server"
import { adminOnly, getAuthUserId } from "@/lib/auth"
import { unreadNotificationCount } from "@/lib/db/notifications"

export async function GET() {
  const denied = await adminOnly()
  if (denied) return denied

  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const unread = await unreadNotificationCount(userId)
  return NextResponse.json({ unread })
}
