import { NextRequest, NextResponse } from "next/server"
import { adminOnly, getAuthUserId } from "@/lib/auth"
import { revokeAdminPushDevice, revokeAllAdminPushDevices } from "@/lib/db/push-subscriptions"
import { rateLimit } from "@/lib/rate-limit"

export async function DELETE(req: NextRequest) {
  const denied = await adminOnly()
  if (denied) return denied
  const adminId = await getAuthUserId()
  if (!adminId || !(await rateLimit(`admin-push-devices:${adminId}`, { limit: 20, windowMs: 60 * 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as { id?: unknown; all?: unknown } | null
  if (body?.all === true) {
    const revoked = await revokeAllAdminPushDevices(adminId)
    return NextResponse.json({ ok: true, revoked })
  }
  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "Dispositivo inválido." }, { status: 400 })
  }
  const revoked = await revokeAdminPushDevice(body.id, adminId)
  if (!revoked) return NextResponse.json({ error: "Dispositivo não encontrado." }, { status: 404 })
  return NextResponse.json({ ok: true, revoked: 1 })
}
