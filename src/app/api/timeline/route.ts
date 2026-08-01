import { NextRequest, NextResponse } from "next/server"
import { getHomeTimelinePage, type PublicFeedMode } from "@/lib/public-content-cache"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

const PAGE_SIZE = 10
const MAX_PAGE = 10_000
const FEED_MODES = new Set<PublicFeedMode>(["all", "posts", "notes"])
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
}
const PRIVATE_CACHE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" }

export async function GET(request: NextRequest) {
  const identity = requestIdentity(request)
  if (!(await rateLimit(`timeline-read:${identity}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }

  const rawPage = Number(request.nextUrl.searchParams.get("page") ?? 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, MAX_PAGE) : 1
  const rawMode = request.nextUrl.searchParams.get("mode") ?? "all"
  const mode = FEED_MODES.has(rawMode as PublicFeedMode) ? rawMode as PublicFeedMode : "all"
  const search = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? ""

  if (search.length > 120) {
    return NextResponse.json({ error: "A busca deve ter no máximo 120 caracteres." }, { status: 400 })
  }
  if (search && !(await rateLimit(`timeline-search:${identity}`, { limit: 30, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas buscas. Tente novamente em instantes." }, { status: 429 })
  }

  const result = await getHomeTimelinePage({
    page,
    mode,
    limit: PAGE_SIZE,
    search: search || undefined,
  })

  return NextResponse.json(result, {
    headers: search ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS,
  })
}
