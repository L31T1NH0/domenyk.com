import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId, isAdmin } from "@/lib/auth"
import {
  deletePushSubscription,
  getPushSubscription,
  PUSH_TOPICS,
  revokePrivatePushSubscription,
  upsertPushSubscription,
  verifyAdminPushSubscription,
  verifyMessagePushSubscription,
  type PushTopic,
} from "@/lib/db/push-subscriptions"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
  "web.push.apple.com",
  "push.apple.com",
]

function sameSite(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true
  const requestOrigin = new URL(req.url).origin
  const origin = req.headers.get("origin")
  if (origin) {
    try {
      if (new URL(origin).origin !== requestOrigin) return false
    } catch {
      return false
    }
  }
  const site = req.headers.get("sec-fetch-site")
  return site === "same-origin"
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && ALLOWED_PUSH_HOSTS.some((host) => (
      url.hostname === host || url.hostname.endsWith(`.${host}`)
    ))
  } catch {
    return false
  }
}

function validKey(value: unknown, bytes: number, firstByte?: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false
  const decoded = Buffer.from(value, "base64url")
  return decoded.length === bytes && (firstByte === undefined || decoded[0] === firstByte)
}

function topicsFrom(value: unknown): PushTopic[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((topic): topic is PushTopic => (
    typeof topic === "string" && PUSH_TOPICS.includes(topic as PushTopic)
  ))))
}

export async function PUT(req: NextRequest) {
  if (!sameSite(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-status:${requestIdentity(req)}`, { limit: 60, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }
  const body = await req.json().catch(() => null) as { endpoint?: unknown } | null
  if (!validEndpoint(body?.endpoint)) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  const subscription = await getPushSubscription(body.endpoint)
  const admin = await isAdmin()
  const userId = await getAuthUserId()
  if (subscription?.adminEvents && userId && subscription.adminUserId === userId) {
    await verifyAdminPushSubscription(body.endpoint, userId)
  }
  if (subscription?.messageEvents && userId && subscription.messageUserId === userId) {
    await verifyMessagePushSubscription(body.endpoint, userId)
  }
  return NextResponse.json({
    subscribed: Boolean(subscription),
    topics: subscription?.topics ?? [],
    adminEvents: admin ? subscription?.adminEvents === true : false,
    messageEvents: Boolean(userId && subscription?.messageEvents && subscription.messageUserId === userId),
  })
}

export async function POST(req: NextRequest) {
  if (!sameSite(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-subscribe:${requestIdentity(req)}`, { limit: 20, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    endpoint?: unknown
    expirationTime?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
    topics?: unknown
    adminEvents?: unknown
    messageEvents?: unknown
  } | null
  if (
    !validEndpoint(body?.endpoint) ||
    !validKey(body?.keys?.p256dh, 65, 0x04) ||
    !validKey(body?.keys?.auth, 16)
  ) {
    return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  }

  const userId = await getAuthUserId()
  const admin = userId ? await isAdmin() : false
  await upsertPushSubscription({
    endpoint: body.endpoint,
    expirationTime: typeof body.expirationTime === "number" ? body.expirationTime : null,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    topics: topicsFrom(body.topics),
    userAgent: req.headers.get("user-agent")?.slice(0, 300),
    ...(admin && userId ? { admin: { enabled: body.adminEvents === true, userId } } : {}),
    ...(userId ? { messages: { enabled: body.messageEvents === true, userId } } : {}),
  })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  if (!sameSite(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-private-revoke:${requestIdentity(req)}`, { limit: 10, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as { endpoint?: unknown } | null
  if (!validEndpoint(body?.endpoint)) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  await revokePrivatePushSubscription(body.endpoint, userId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!sameSite(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-delete:${requestIdentity(req)}`, { limit: 20, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }
  const body = await req.json().catch(() => null) as { endpoint?: unknown } | null
  if (!validEndpoint(body?.endpoint)) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  await deletePushSubscription(body.endpoint)
  return NextResponse.json({ ok: true })
}
