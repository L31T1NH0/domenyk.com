import { NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { listMessageThreadsPage, serializeMessageThreadSummary } from "@/lib/db/messages"

export async function GET(req: Request) {
  const denied = await adminOnly()
  if (denied) return denied
  const url = new URL(req.url)
  const page = await listMessageThreadsPage({ cursor: url.searchParams.get("cursor") ?? undefined, archived: url.searchParams.get("archived") === "1" })
  return NextResponse.json({ items: page.threads.map(serializeMessageThreadSummary), hasMore: page.hasMore, nextCursor: page.nextCursor })
}
