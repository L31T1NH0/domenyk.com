import { NextRequest, NextResponse } from "next/server"
import { countOpenMessageThreads, createMessageThread, listMessageThreadsPage, MAX_OPEN_THREADS_PER_USER, serializeMessageThread, serializeMessageThreadSummary, type MessageThread } from "@/lib/db/messages"
import { createNotification } from "@/lib/db/notifications"
import { getAdminUserId, getAuthUser } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const page = await listMessageThreadsPage({ ownerId: user.id, cursor: req.nextUrl.searchParams.get("cursor") ?? undefined, archived: req.nextUrl.searchParams.get("archived") === "1" })
  return NextResponse.json({ items: page.threads.map(serializeMessageThreadSummary), hasMore: page.hasMore, nextCursor: page.nextCursor })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await rateLimit(`message:${user.id}`, { limit: 5, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas mensagens em pouco tempo." }, { status: 429 })
  }
  const identity = requestIdentity(req)
  const [withinDailyUserLimit, withinDailyIpLimit, openThreads] = await Promise.all([
    rateLimit(`message-daily-user:${user.id}`, { limit: 20, windowMs: 24 * 60 * 60_000 }),
    rateLimit(`message-daily-ip:${identity}`, { limit: 40, windowMs: 24 * 60 * 60_000 }),
    countOpenMessageThreads(user.id),
  ])
  if (!withinDailyUserLimit || !withinDailyIpLimit) return NextResponse.json({ error: "Limite diário de mensagens atingido." }, { status: 429 })
  if (openThreads >= MAX_OPEN_THREADS_PER_USER) return NextResponse.json({ error: "Você já possui muitos assuntos em aberto." }, { status: 409 })
  const body = await req.json().catch(() => null) as { subject?: unknown; body?: unknown; category?: unknown } | null
  const subject = clean(body?.subject, 120)
  const message = clean(body?.body, 5000)
  const category = typeof body?.category === "string" && ["idea", "correction", "improvement", "other"].includes(body.category)
    ? body.category as MessageThread["category"] : "other"
  if (subject.length < 3 || message.length < 10) return NextResponse.json({ error: "Escreva um assunto e uma mensagem mais completos." }, { status: 400 })
  const thread = await createMessageThread({ ownerId: user.id, ownerName: user.name, subject, body: message, category })
  const adminId = getAdminUserId()
  if (adminId) await createNotification({ recipientId: adminId, actorId: user.id, kind: "message", title: `Nova mensagem: ${subject}`, description: `${user.name} enviou uma ideia.`, href: `/admin/messages#${thread._id}` }).catch(() => null)
  return NextResponse.json(serializeMessageThread(thread, user.id), { status: 201 })
}
