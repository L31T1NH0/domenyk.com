import { NextRequest, NextResponse } from "next/server"
import { getPosts } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const pageParam = Number(searchParams.get("page") ?? 1)
  const page = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, 500) : 1
  const search = searchParams.get("search") ?? undefined
  const admin = await isAdmin()

  const { posts, total } = await getPosts({
    page,
    search,
    includeUnpublished: admin,
    excludeHiddenFromTimeline: !admin,
  })

  return NextResponse.json({ posts, total })
}
