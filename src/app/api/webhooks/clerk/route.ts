import { verifyWebhook } from "@clerk/nextjs/webhooks"
import type { NextRequest } from "next/server"
import { getAdminUserId } from "@/lib/auth"
import { createNotificationOnce } from "@/lib/admin-notifications"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  let event
  try {
    event = await verifyWebhook(request)
  } catch {
    return Response.json({ error: "Assinatura do webhook inválida." }, { status: 400 })
  }

  if (event.type !== "user.created") {
    return Response.json({ received: true, handled: false })
  }

  const adminId = getAdminUserId()
  if (!adminId) {
    return Response.json({ error: "Admin user is not configured" }, { status: 503 })
  }

  const user = event.data
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  const name = fullName || user.username || user.email_addresses[0]?.email_address || "Uma nova pessoa"
  const notificationId = await createNotificationOnce({
    recipientId: adminId,
    actorId: user.id,
    actorImageUrl: user.image_url,
    aggregateKey: `account-created:${user.id}`,
    kind: "account",
    title: "Nova conta criada",
    description: `${name} criou uma conta.`,
    href: "/admin/users",
  }, "accounts")

  return Response.json({ received: true, handled: true, created: Boolean(notificationId) })
}
