import { NextResponse } from "next/server"
import { getAuthUserId, isAdmin } from "@/lib/auth"
import { unreadMessageCount } from "@/lib/db/messages"

export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ unread: 0 }, { status: 401 })
  return NextResponse.json({ unread: await unreadMessageCount(userId, await isAdmin()) })
}
