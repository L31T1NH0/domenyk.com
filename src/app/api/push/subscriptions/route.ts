import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId, isAdmin } from "@/lib/auth"
import {
  deletePushSubscription,
  getPushSubscription,
  PUSH_TOPICS,
  pushCapabilityMatches,
  revokePrivatePushSubscription,
  upsertPushSubscription,
  verifyAdminPushSubscription,
  verifyMessagePushSubscription,
  type PushTopic,
} from "@/lib/db/push-subscriptions"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { isSameOriginRequest } from "@/lib/csrf"
import { sendPushSubscriptionChallenge } from "@/lib/push"

const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
  "web.push.apple.com",
  "push.apple.com",
]

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

function authFromBody(body: { keys?: { auth?: unknown } } | null): string | null {
  return validKey(body?.keys?.auth, 16) ? body.keys.auth : null
}

export async function PUT(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-status:${requestIdentity(req)}`, { limit: 60, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }
  const body = await req.json().catch(() => null) as { endpoint?: unknown; keys?: { auth?: unknown } } | null
  const auth = authFromBody(body)
  if (!validEndpoint(body?.endpoint) || !auth) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  const subscription = await getPushSubscription(body.endpoint)
  if (!subscription || !pushCapabilityMatches(subscription, auth)) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 })
  }
  const admin = await isAdmin()
  const userId = await getAuthUserId()
  if (subscription?.adminEvents && userId && subscription.adminUserId === userId) {
    await verifyAdminPushSubscription(body.endpoint, userId)
  }
  if (subscription?.messageEvents && userId && subscription.messageUserId === userId) {
    await verifyMessagePushSubscription(body.endpoint, userId)
  }
  return NextResponse.json({
    subscribed: subscription.status === "active",
    pending: subscription.status === "pending",
    topics: subscription.status === "active" ? subscription.topics : [],
    adminEvents: subscription.status === "active" && admin ? subscription.adminEvents === true : false,
    messageEvents: Boolean(subscription.status === "active" && userId && subscription.messageEvents && subscription.messageUserId === userId),
  })
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
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
  const existing = await getPushSubscription(body.endpoint)
  if (existing && !pushCapabilityMatches(existing, body.keys.auth)) {
    return NextResponse.json({ error: "A inscrição não pertence a este dispositivo." }, { status: 403 })
  }
  if (!existing) {
    const identity = requestIdentity(req)
    const [withinIpLimit, withinGlobalLimit] = await Promise.all([
      rateLimit(`push-subscribe-new:${identity}`, { limit: 5, windowMs: 24 * 60 * 60_000 }),
      rateLimit("push-subscribe-new:global", { limit: 200, windowMs: 24 * 60 * 60_000 }),
    ])
    if (!withinIpLimit || !withinGlobalLimit) {
      return NextResponse.json({ error: "Limite de novos dispositivos atingido." }, { status: 429 })
    }
  }

  const saved = await upsertPushSubscription({
    endpoint: body.endpoint,
    expirationTime: typeof body.expirationTime === "number" ? body.expirationTime : null,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    topics: topicsFrom(body.topics),
    userAgent: req.headers.get("user-agent")?.slice(0, 300),
    ...(admin && userId ? { admin: { enabled: body.adminEvents === true, userId } } : {}),
    ...(userId ? { messages: { enabled: body.messageEvents === true, userId } } : {}),
  })

  if (saved.challengeToken) {
    const delivered = await sendPushSubscriptionChallenge(saved.subscription, saved.challengeToken)
    if (!delivered) {
      await deletePushSubscription(body.endpoint)
      return NextResponse.json({ error: "Não foi possível confirmar este dispositivo." }, { status: 502 })
    }
    return NextResponse.json({ ok: true, pending: true }, { status: 202 })
  }

  return NextResponse.json({ ok: true, pending: false })
}

export async function PATCH(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-private-revoke:${requestIdentity(req)}`, { limit: 10, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as { endpoint?: unknown; keys?: { auth?: unknown } } | null
  const auth = authFromBody(body)
  if (!validEndpoint(body?.endpoint) || !auth) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  const subscription = await getPushSubscription(body.endpoint)
  if (!subscription || !pushCapabilityMatches(subscription, auth)) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 })
  }
  await revokePrivatePushSubscription(body.endpoint, userId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-delete:${requestIdentity(req)}`, { limit: 20, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }
  const body = await req.json().catch(() => null) as { endpoint?: unknown; keys?: { auth?: unknown } } | null
  const auth = authFromBody(body)
  if (!validEndpoint(body?.endpoint) || !auth) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  const subscription = await getPushSubscription(body.endpoint)
  if (!subscription || !pushCapabilityMatches(subscription, auth)) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 })
  }
  await deletePushSubscription(body.endpoint)
  return NextResponse.json({ ok: true })
}
