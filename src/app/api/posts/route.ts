import { NextRequest, NextResponse } from "next/server"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const pageParam = Number(searchParams.get("page") ?? 1)
  const page = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, 500) : 1
  const rawSearch = searchParams.get("search")?.trim()
  if (rawSearch && rawSearch.length > 120) {
    return NextResponse.json({ error: "A busca deve ter no máximo 120 caracteres." }, { status: 400 })
  }
  const search = rawSearch || undefined
  if (search && !(await rateLimit(
    `post-search:${requestIdentity(req)}`,
    { limit: 30, windowMs: 60_000 }
  ))) {
    return NextResponse.json({ error: "Muitas buscas. Tente novamente em instantes." }, { status: 429 })
  }
  const admin = await isAdmin()

  const { posts, total } = await getPosts({
    page,
    search,
    includeUnpublished: admin,
    excludeHiddenFromTimeline: !admin,
  })

  return NextResponse.json({ posts: posts.map(serializePostSummary), total })
}
