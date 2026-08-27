import { createHash } from "node:crypto"
import { after, NextRequest, NextResponse } from "next/server"
import { getAdminUserId, getAuthUser, getAuthUserId } from "@/lib/auth"
import { notifySiteVisit } from "@/lib/admin-notifications"
import { getSiteVisitNotificationSettings } from "@/lib/db/notification-settings"
import { claimOncePerWindow, rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { viewRequestDetails, type ViewClientContext } from "@/lib/view-request-details"

const VISIT_DEDUPLICATION_WINDOW_MS = 60 * 60_000

function validPublicPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") &&
    value.length <= 500 && value !== "/admin" && !value.startsWith("/admin/") &&
    value !== "/api" && !value.startsWith("/api/") && !value.startsWith("/_next/")
}

export async function POST(req: NextRequest) {
  const settings = await getSiteVisitNotificationSettings()
  if (!settings.pushEnabled && !settings.storeInHistory) return new Response(null, { status: 204 })
  const adminId = getAdminUserId()
  if (!adminId) return NextResponse.json({ error: "Admin user is not configured" }, { status: 503 })

  const body = await req.json().catch(() => null) as ({ path?: unknown } & ViewClientContext) | null
  const path = body?.path
  if (!validPublicPath(path)) {
    return NextResponse.json({ error: "Página inválida." }, { status: 400 })
  }

  const details = { ...viewRequestDetails(req, body ?? {}), page: path }
  if (details.trafficType === "Bot") return new Response(null, { status: 204 })

  const identity = requestIdentity(req)
  const [withinVisitorLimit, withinGlobalLimit, userId] = await Promise.all([
    rateLimit(`site-visit:${identity}`, { limit: 120, windowMs: 60 * 60_000 }),
    rateLimit("site-visit:global", { limit: 1_500, windowMs: 60 * 60_000 }),
    getAuthUserId(),
  ])
  if (!withinVisitorLimit || !withinGlobalLimit) {
    return NextResponse.json({ error: "Limite de visitas atingido." }, { status: 429 })
  }
  if (userId && userId === adminId) return new Response(null, { status: 204 })

  const pathHash = createHash("sha256").update(path).digest("hex").slice(0, 24)
  const clientVisitorId = typeof body?.visitorId === "string" && /^[a-f\d-]{36}$/i.test(body.visitorId)
    ? body.visitorId
    : null
  const visitor = userId
    ? `account:${userId}`
    : clientVisitorId
      ? `browser:${clientVisitorId}`
      : `network:${identity}`
  const visitHash = createHash("sha256").update(`${visitor}\n${path}`).digest("hex")
  const firstVisitInWindow = await claimOncePerWindow(
    `site-visit-page:${visitHash}`,
    VISIT_DEDUPLICATION_WINDOW_MS
  )
  if (!firstVisitInWindow) {
    return NextResponse.json({ received: true, deduplicated: true }, { status: 202 })
  }

  const viewer = userId ? await getAuthUser() : null
  const description = viewer
    ? `${viewer.name} abriu ${path}.`
    : `Uma pessoa abriu ${path}.`

  after(() => notifySiteVisit({
    data: {
      recipientId: adminId,
      kind: "site_visit",
      aggregateKey: `site-visit:${pathHash}`,
      title: viewer ? `${viewer.name} visitou o site` : "Nova visita no site",
      description,
      href: path,
    },
    occurrenceDetails: details,
    storeInHistory: settings.storeInHistory,
    sendPush: settings.pushEnabled,
  }).catch(() => undefined))

  return NextResponse.json({ received: true }, { status: 202 })
}
