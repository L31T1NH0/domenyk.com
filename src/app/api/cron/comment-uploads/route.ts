import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { cleanupExpiredCommentUploads } from "@/lib/db/comment-uploads"

function validCronAuthorization(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")
  if (!secret || !authorization) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authorization)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 })
  }
  if (!validCronAuthorization(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await cleanupExpiredCommentUploads({ maxDurationMs: 25_000, concurrency: 4 })
  return NextResponse.json(result)
}
