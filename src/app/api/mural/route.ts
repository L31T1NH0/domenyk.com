import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { createPersonalUpdate, getPersonalUpdates } from "@/lib/db/personal-timeline"
import { personalUpdateContent } from "@/lib/personal-timeline"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

export async function GET(req: NextRequest) {
  if (!(await rateLimit(`mural-read:${requestIdentity(req)}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 })
  }
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  if (cursor !== undefined && !/^[a-f\d]{24}$/i.test(cursor)) {
    return NextResponse.json({ error: "Cursor inválido." }, { status: 400 })
  }
  return NextResponse.json(await getPersonalUpdates(cursor), { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const content = personalUpdateContent(await req.json().catch(() => null))
  if (!content) return NextResponse.json({ error: "A publicação está vazia ou ultrapassou 300.000 caracteres." }, { status: 400 })
  return NextResponse.json(await createPersonalUpdate(content), { status: 201 })
}
