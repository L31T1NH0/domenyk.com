import { NextRequest, NextResponse } from "next/server"
import {
  appendNotificationAction,
  completeNotificationReading,
  type NotificationActionType,
} from "@/lib/db/notifications"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

const ACTIONS = new Set<NotificationActionType>(["copied_link", "commented", "sent_message"])

function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function PATCH(req: NextRequest) {
  if (!(await rateLimit(`engagement:${requestIdentity(req)}`, { limit: 20, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    token?: unknown
    event?: unknown
    action?: unknown
    activeSeconds?: unknown
    progress?: unknown
  } | null

  if (!validToken(body?.token)) return NextResponse.json({ error: "Token inválido." }, { status: 400 })

  if (body.event === "reading_completed") {
    const activeSeconds = Math.min(24 * 60 * 60, Math.max(1, Math.round(Number(body.activeSeconds))))
    const progress = Math.min(100, Math.max(0, Math.round(Number(body.progress))))
    if (!Number.isFinite(activeSeconds) || !Number.isFinite(progress)) {
      return NextResponse.json({ error: "Métricas inválidas." }, { status: 400 })
    }
    const updated = await completeNotificationReading(body.token, activeSeconds, progress)
    if (!updated) return NextResponse.json({ error: "Token expirado ou evento já registrado." }, { status: 410 })
    return NextResponse.json({ ok: true })
  }

  if (body.event === "action" && typeof body.action === "string" && ACTIONS.has(body.action as NotificationActionType)) {
    const updated = await appendNotificationAction(body.token, body.action as NotificationActionType)
    if (!updated) return NextResponse.json({ error: "Token expirado ou ação já registrada." }, { status: 410 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Evento inválido." }, { status: 400 })
}
