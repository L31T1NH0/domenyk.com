import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { commentAccountPolicy } from "@/lib/comment-policy"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

type CommentUser = {
  id: string
  emailVerified: boolean
  createdAt: Date
}

export async function enforceCommentPolicy(
  req: NextRequest,
  user: CommentUser,
  admin: boolean
): Promise<NextResponse<{ error: string }> | null> {
  const policy = commentAccountPolicy({
    admin,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  })

  if (!policy.allowed) {
    const error = policy.reason === "email_unverified"
      ? "Confirme seu endereço de email antes de comentar."
      : "Contas novas podem comentar uma hora após o cadastro."
    return NextResponse.json({ error }, { status: 403 })
  }

  if (admin) return null

  const identity = requestIdentity(req)
  const minuteLimit = policy.newAccount ? 4 : 8
  const dailyLimit = policy.newAccount ? 10 : 30
  const checks = await Promise.all([
    rateLimit(`comment-global:user:${user.id}`, { limit: minuteLimit, windowMs: 60_000 }),
    rateLimit(`comment-global:ip:${identity}`, { limit: 20, windowMs: 60_000 }),
    rateLimit(`comment-daily:user:${user.id}`, { limit: dailyLimit, windowMs: 24 * 60 * 60_000 }),
    rateLimit(`comment-daily:ip:${identity}`, { limit: 80, windowMs: 24 * 60 * 60_000 }),
  ])

  if (checks.every(Boolean)) return null
  return NextResponse.json(
    { error: "Limite de comentários atingido. Tente novamente mais tarde." },
    { status: 429 }
  )
}
