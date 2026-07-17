import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"
import { getAdminUserId } from "@/lib/auth"
import { createNotificationOnce } from "@/lib/db/notifications"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { isSameOriginRequest } from "@/lib/csrf"

export const runtime = "nodejs"

const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Origem não permitida." }, { status: 403 })
  }
  if (!(await rateLimit(`account-registration-ip:${requestIdentity(request)}`, { limit: 20, windowMs: 60 * 60_000 }))) {
    return Response.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }

  const { userId } = await auth()
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await rateLimit(`account-registration-user:${userId}`, { limit: 3, windowMs: NEW_ACCOUNT_WINDOW_MS }))) {
    return Response.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const accountAge = Date.now() - user.createdAt
  if (accountAge < 0 || accountAge > NEW_ACCOUNT_WINDOW_MS) {
    return Response.json({ received: true, created: false })
  }

  const adminId = getAdminUserId()
  if (!adminId) {
    return Response.json({ error: "Admin user is not configured" }, { status: 503 })
  }

  const name = user.fullName ?? user.username ?? "Uma nova pessoa"

  const notificationId = await createNotificationOnce({
    recipientId: adminId,
    actorId: user.id,
    actorImageUrl: user.imageUrl,
    aggregateKey: `account-created:${user.id}`,
    kind: "account",
    title: "Nova conta criada",
    description: `${name} criou uma conta.`,
    href: "/admin/users",
  })

  return Response.json({ received: true, created: Boolean(notificationId) })
}
