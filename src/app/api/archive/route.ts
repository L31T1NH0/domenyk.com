import { NextRequest, NextResponse } from "next/server"
import { getTimelineArchiveItems, getTimelineCategoryItems } from "@/lib/db/timeline"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

const PAGE_SIZE = 10
const FEED_MODES = new Set(["all", "posts", "notes"] as const)
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
}
const PRIVATE_CACHE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" }

export async function GET(request: NextRequest) {
  const identity = requestIdentity(request)
  if (!(await rateLimit(`archive-read:${identity}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }

  const year = Number(request.nextUrl.searchParams.get("year"))
  const month = Number(request.nextUrl.searchParams.get("month"))
  const category = request.nextUrl.searchParams.get("category")?.trim() ?? ""
  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0)
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? Math.min(rawOffset, 10_000) : 0
  const search = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? ""
  const rawMode = request.nextUrl.searchParams.get("mode") ?? "all"
  const mode = FEED_MODES.has(rawMode as "all" | "posts" | "notes")
    ? rawMode as "all" | "posts" | "notes"
    : "all"

  if (search.length > 120) {
    return NextResponse.json({ error: "A busca deve ter no máximo 120 caracteres." }, { status: 400 })
  }

  if (category) {
    if (category.length > 100) {
      return NextResponse.json({ error: "Categoria inválida." }, { status: 400 })
    }
    const result = await getTimelineCategoryItems({
      slug: category,
      offset,
      limit: PAGE_SIZE,
      search: search || undefined,
      mode,
    })
    return NextResponse.json(result, { headers: search ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS })
  }

  if (!Number.isInteger(year) || year < 1970 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 })
  }

  const result = await getTimelineArchiveItems({
    year,
    month,
    offset,
    limit: PAGE_SIZE,
    search: search || undefined,
    mode,
  })
  return NextResponse.json(result, { headers: search ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS })
}
