import { createHash, randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getAdminUserId, getAuthUser, isAdmin } from "@/lib/auth"
import { recordActivityEvent } from "@/lib/db/activity"
import { aggregateNotification, createNotification } from "@/lib/db/notifications"
import { getPostByPublicId, incrementPostViewsOnce } from "@/lib/db/posts"
import { isPostLocale } from "@/lib/post-locales"
import { getPostVersion } from "@/lib/post-versions"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { viewRequestDetails, type ViewClientContext } from "@/lib/view-request-details"

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: publicId } = await params
  if (!publicId || publicId.length > 180) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => null) as ({ locale?: unknown } & ViewClientContext) | null
  const locale = typeof body?.locale === "string" ? body.locale : "pt"
  if (!isPostLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  const post = await getPostByPublicId(publicId)
  const version = post ? getPostVersion(post, locale) : null
  if (!post || !version?.published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const cookieName = viewCookieName(publicId)
  if (await isAdmin() || req.cookies.has(cookieName)) {
    return NextResponse.json({ views: post.views ?? 0, viewCounted: false })
  }
  if (!(await rateLimit(`post-view:${requestIdentity(req)}`, { limit: 120, windowMs: 24 * 60 * 60_000 }))) {
    return NextResponse.json({ views: post.views ?? 0, viewCounted: false }, { status: 429 })
  }

  const result = await incrementPostViewsOnce(publicId, viewVisitorKey(req, publicId))
  const viewer = result.counted ? await getAuthUser() : null
  if (result.counted) {
    await recordActivityEvent({
      type: "post_view", visitorKey: requestIdentity(req), isAuthenticated: Boolean(viewer),
      ...(viewer ? { userId: viewer.id, userName: viewer.name } : {}), postId: post._id, postPublicId: post.publicId,
      postSlug: post.slug, postTitle: version.title, locale,
    }).catch(() => undefined)
  }

  const adminId = getAdminUserId()
  let readingToken: string | undefined
  if (result.counted && adminId) {
    readingToken = randomUUID()
    const details = { ...viewRequestDetails(req, body ?? {}), id: readingToken }
    if (viewer) {
      await createNotification({
        recipientId: adminId, actorId: viewer.id, actorImageUrl: viewer.imageUrl, kind: "view",
        title: `${viewer.name} visitou ${version.title}`,
        description: `Visita de usuário autenticado · ${result.views} visualizações no total.`,
        href: `/posts/${post.slug}`,
      }, details).catch(() => undefined)
    } else {
      await aggregateNotification({
        recipientId: adminId, kind: "view", aggregateKey: `view:${publicId}`,
        title: `Novas visualizações em ${version.title}`,
        description: `O post chegou a ${result.views} visualizações.`, href: `/posts/${post.slug}`,
      }, details).catch(() => undefined)
    }
  }

  const response = NextResponse.json({ views: result.views, viewCounted: result.counted, readingToken })
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    maxAge: VIEW_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return response
}
