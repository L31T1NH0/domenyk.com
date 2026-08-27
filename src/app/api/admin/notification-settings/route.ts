import { NextRequest, NextResponse } from "next/server"
import { adminOnly, getAuthUserId } from "@/lib/auth"
import { setSiteVisitNotificationSettings } from "@/lib/db/notification-settings"
import { rateLimit } from "@/lib/rate-limit"

export async function PATCH(req: NextRequest) {
  const denied = await adminOnly()
  if (denied) return denied
  const adminId = await getAuthUserId()
  if (!adminId || !(await rateLimit(`admin-notification-settings:${adminId}`, {
    limit: 30,
    windowMs: 60 * 60_000,
  }))) {
    return NextResponse.json({ error: "Muitas alterações em pouco tempo." }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    pushSiteVisits?: unknown
    siteVisitsEnabled?: unknown
    storeSiteVisits?: unknown
  } | null
  const pushSiteVisits = typeof body?.pushSiteVisits === "boolean"
    ? body.pushSiteVisits
    : body?.siteVisitsEnabled
  const input = {
    ...(typeof pushSiteVisits === "boolean" ? { pushEnabled: pushSiteVisits } : {}),
    ...(typeof body?.storeSiteVisits === "boolean" ? { storeInHistory: body.storeSiteVisits } : {}),
  }
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Configuração inválida." }, { status: 400 })
  }

  const settings = await setSiteVisitNotificationSettings(input)
  return NextResponse.json({
    pushSiteVisits: settings.pushEnabled,
    siteVisitsEnabled: settings.pushEnabled,
    storeSiteVisits: settings.storeInHistory,
  })
}
