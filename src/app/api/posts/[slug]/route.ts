import { NextRequest, NextResponse } from "next/server"
import { getPostByPublicId, serializePost } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"
import { isPostLocale } from "@/lib/post-locales"
import { getPostVersion } from "@/lib/post-versions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: publicId } = await params
  if (!publicId || publicId.length > 180) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const post = await getPostByPublicId(publicId)

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const localeParam = req.nextUrl.searchParams.get("locale") ?? "pt"
  if (!isPostLocale(localeParam)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }
  const version = getPostVersion(post, localeParam)
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const admin = await isAdmin()

  if (!version.published && !admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const publicPost = {
    ...serializePost(post),
    title: version.title,
    content: version.content,
    excerpt: version.excerpt,
    subtitle: version.subtitle,
    cover: version.cover,
    published: version.published,
    publishedAt: version.publishedAt?.toISOString(),
    readingTimeMinutes: version.readingTimeMinutes,
    updatedAt: version.updatedAt.toISOString(),
    locale: localeParam,
  }
  return NextResponse.json(
    { ...publicPost, viewCounted: false },
    {
      headers: admin
        ? { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" }
        : { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
    }
  )
}
