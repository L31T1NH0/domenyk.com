import { NextRequest, NextResponse } from "next/server"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { getAuthUserId, isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { getCachedPublicPosts } from "@/lib/public-content-cache"

const PUBLIC_CACHE_HEADERS = { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" }
const PRIVATE_CACHE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const pageParam = Number(searchParams.get("page") ?? 1)
  const page = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, 500) : 1
  const rawSearch = searchParams.get("search")?.trim()
  if (rawSearch && rawSearch.length > 120) {
    return NextResponse.json({ error: "A busca deve ter no máximo 120 caracteres." }, { status: 400 })
  }
  const search = rawSearch || undefined
  const identity = requestIdentity(req)
  if (!(await rateLimit(`post-read:${identity}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }
  if (search && !(await rateLimit(
    `post-search:${identity}`,
    { limit: 30, windowMs: 60_000 }
  ))) {
    return NextResponse.json({ error: "Muitas buscas. Tente novamente em instantes." }, { status: 429 })
  }
  const userId = await getAuthUserId()
  const admin = userId ? await isAdmin() : false

  if (!admin && !search) {
    const result = await getCachedPublicPosts(page, 10)
    return NextResponse.json(result, { headers: userId ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS })
  }

  const { posts, total } = await getPosts({ page, search, includeUnpublished: admin, excludeHiddenFromTimeline: !admin })

  return NextResponse.json(
    { posts: posts.map((post) => serializePostSummary(post)), total },
    { headers: userId ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS }
  )
}
