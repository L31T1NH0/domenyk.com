import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { getPostByPublicId, incrementPostViews } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"

const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24

function viewCookieName(publicId: string) {
  const hash = createHash("sha256").update(publicId).digest("hex").slice(0, 16)
  return `post_viewed_${hash}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: publicId } = await params
  const post = await getPostByPublicId(publicId)

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const admin = await isAdmin()

  if (!post.published && !admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const shouldTrackView = req.nextUrl.searchParams.get("view") === "1"
  const cookieName = viewCookieName(publicId)
  const hasViewCookie = req.cookies.has(cookieName)
  let counted = false

  if (shouldTrackView && post.published && !admin && !hasViewCookie) {
    post.views = await incrementPostViews(publicId)
    counted = true
  }

  const response = NextResponse.json({ ...post, viewCounted: counted })

  if (shouldTrackView && post.published && !admin && !hasViewCookie) {
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
