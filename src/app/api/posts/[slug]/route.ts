import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { getPostByPublicId, incrementPostViewsOnce, serializePost } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24

function viewCookieName(publicId: string) {
  const hash = createHash("sha256").update(publicId).digest("hex").slice(0, 16)
  return `post_viewed_${hash}`
}

function viewVisitorKey(req: NextRequest, publicId: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash("sha256")
    .update(`${day}\n${publicId}\n${requestIdentity(req)}`)
    .digest("hex")
}

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

  const admin = await isAdmin()

  if (!post.published && !admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const shouldTrackView = req.nextUrl.searchParams.get("view") === "1"
  const cookieName = viewCookieName(publicId)
  const hasViewCookie = req.cookies.has(cookieName)
  let counted = false

  let withinViewLimit = true
  if (shouldTrackView && post.published && !admin && !hasViewCookie) {
    withinViewLimit = await rateLimit(
      `post-view:${requestIdentity(req)}`,
      { limit: 120, windowMs: 24 * 60 * 60_000 }
    )
  }

  if (shouldTrackView && post.published && !admin && !hasViewCookie && withinViewLimit) {
    const result = await incrementPostViewsOnce(publicId, viewVisitorKey(req, publicId))
    post.views = result.views
    counted = result.counted
  }

  const publicPost = serializePost(post)
  const response = NextResponse.json(
    shouldTrackView
      ? { views: publicPost.views ?? 0, viewCounted: counted }
      : { ...publicPost, viewCounted: counted }
  )

  if (shouldTrackView && post.published && !admin && !hasViewCookie && withinViewLimit) {
    response.cookies.set(cookieName, "1", {
      httpOnly: true,
      maxAge: VIEW_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }

  return response
}
