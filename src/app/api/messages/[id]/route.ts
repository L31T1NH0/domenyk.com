import { NextRequest, NextResponse } from "next/server"
import { addMessageReply, deleteMessageThread, getMessageThread, getMessageThreadForOwner, markMessageThreadRead, serializeMessageThread, setMessageThreadArchived, setMessageThreadStatus, type MessageThread } from "@/lib/db/messages"
import { createNotification, deleteNotificationsForMessageThread } from "@/lib/db/notifications"
import { getAdminUserId, getAuthUser, isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const admin = await isAdmin()
  const thread = admin ? await getMessageThread(id) : await getMessageThreadForOwner(id, user.id)
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const readThread = await markMessageThreadRead(id, user.id, admin ? undefined : user.id)
  return NextResponse.json(serializeMessageThread(readThread ?? thread, user.id))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const admin = await isAdmin()
  const thread = admin ? await getMessageThread(id) : await getMessageThreadForOwner(id, user.id)
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await rateLimit(`message-reply:${user.id}`, { limit: 12, windowMs: 60_000 }))) return NextResponse.json({ error: "Muitas respostas em pouco tempo." }, { status: 429 })
  const identity = requestIdentity(req)
  const [withinDailyUserLimit, withinDailyIpLimit] = await Promise.all([
    rateLimit(`message-reply-daily-user:${user.id}`, { limit: 100, windowMs: 24 * 60 * 60_000 }),
    rateLimit(`message-reply-daily-ip:${identity}`, { limit: 150, windowMs: 24 * 60 * 60_000 }),
  ])
  if (!withinDailyUserLimit || !withinDailyIpLimit) return NextResponse.json({ error: "Limite diário de respostas atingido." }, { status: 429 })
  const json = await req.json().catch(() => null) as { body?: unknown } | null
  const body = typeof json?.body === "string" ? json.body.trim().slice(0, 5000) : ""
  if (body.length < 2) return NextResponse.json({ error: "Resposta muito curta." }, { status: 400 })
  if (thread.status === "closed") return NextResponse.json({ error: "Esta conversa está encerrada." }, { status: 409 })
  const updated = await addMessageReply(id, { authorId: user.id, authorName: user.name, body, isAdmin: admin, ownerId: admin ? undefined : user.id })
  if (!updated) return NextResponse.json({ error: "Esta conversa atingiu o limite de respostas." }, { status: 409 })
  const recipientId = admin ? null : getAdminUserId()
  if (recipientId) await createNotification({ recipientId, actorId: user.id, kind: "reply", title: `Resposta em: ${thread.subject}`, description: `${user.name} respondeu à mensagem.`, href: `/admin/messages#${id}` }).catch(() => null)
  return NextResponse.json(serializeMessageThread(updated, user.id))
}

const ALLOWED_STATUSES = new Set<MessageThread["status"]>(["open", "accepted", "declined", "closed"])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const json = await req.json().catch(() => null) as { status?: unknown; archived?: unknown } | null
  if (typeof json?.archived === "boolean") {
    const updated = await setMessageThreadArchived(id, json.archived)
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(serializeMessageThread(updated, user.id))
  }
  if (typeof json?.status !== "string" || !ALLOWED_STATUSES.has(json.status as MessageThread["status"])) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 })
  }
  const updated = await setMessageThreadStatus(id, json.status as MessageThread["status"])
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeMessageThread(updated, user.id))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const admin = await isAdmin()
  const deleted = await deleteMessageThread(id, admin ? undefined : user.id)
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await deleteNotificationsForMessageThread(id).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
