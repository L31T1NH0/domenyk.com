import { NextRequest, NextResponse } from "next/server"
import { verifyPushSubscriptionChallenge } from "@/lib/db/push-subscriptions"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { isSameOriginRequest } from "@/lib/csrf"

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

function validAuth(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false
  return Buffer.from(value, "base64url").length === 16
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  if (!(await rateLimit(`push-verify:${requestIdentity(req)}`, { limit: 10, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    endpoint?: unknown
    keys?: { auth?: unknown }
    challengeToken?: unknown
  } | null
  if (
    !validEndpoint(body?.endpoint) ||
    !validAuth(body?.keys?.auth) ||
    typeof body?.challengeToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(body.challengeToken)
  ) {
    return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 })
  }

  const verified = await verifyPushSubscriptionChallenge(
    body.endpoint,
    body.keys.auth,
    body.challengeToken
  )
  if (!verified) return NextResponse.json({ error: "Confirmação expirada ou inválida." }, { status: 410 })
  return NextResponse.json({ ok: true })
}
