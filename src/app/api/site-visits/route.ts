import { createHash } from "node:crypto"
import { after, NextRequest, NextResponse } from "next/server"
import { getAdminUserId, getAuthUser, getAuthUserId } from "@/lib/auth"
import { notifySiteVisit } from "@/lib/admin-notifications"
import { getSiteVisitNotificationSettings } from "@/lib/db/notification-settings"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { viewRequestDetails, type ViewClientContext } from "@/lib/view-request-details"

function validPublicPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") &&
    value.length <= 500 && value !== "/admin" && !value.startsWith("/admin/") &&
    value !== "/api" && !value.startsWith("/api/") && !value.startsWith("/_next/")
}

export async function POST(req: NextRequest) {
  const settings = await getSiteVisitNotificationSettings()
  if (!settings.enabled) return new Response(null, { status: 204 })
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

  const viewer = userId ? await getAuthUser() : null
  const pathHash = createHash("sha256").update(path).digest("hex").slice(0, 24)
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
  }).catch(() => undefined))

  return NextResponse.json({ received: true }, { status: 202 })
}
