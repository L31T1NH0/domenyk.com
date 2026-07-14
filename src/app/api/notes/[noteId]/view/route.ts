import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getAdminUserId, getAuthUser, isAdmin } from "@/lib/auth"
import { getNote } from "@/lib/db/notes"
import { recordNoteView } from "@/lib/db/note-metrics"
import { aggregateNotification, createNotification } from "@/lib/db/notifications"
import { isNoteViewSource, NOTE_VIEW_TTL_MS } from "@/lib/note-views"
import { noteDisplayTitle } from "@/lib/seo"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { viewRequestDetails } from "@/lib/view-request-details"
import type { ViewClientContext } from "@/lib/view-request-details"

function visitorKey(req: NextRequest, noteId: string, source: string) {
  const day = new Date().toISOString().slice(0, 10)
  return createHash("sha256").update(`${day}\n${noteId}\n${source}\n${requestIdentity(req)}`).digest("hex")
}

function directCookieName(noteId: string) {
  return `note_viewed_${createHash("sha256").update(noteId).digest("hex").slice(0, 16)}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const fetchSite = req.headers.get("sec-fetch-site")
  if (process.env.NODE_ENV === "production" && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return NextResponse.json({ counted: false }, { status: 403 })
  }
  const { noteId } = await params
  const body = await req.json().catch(() => null) as ({ source?: unknown } & ViewClientContext) | null
  if (!isNoteViewSource(body?.source)) return NextResponse.json({ error: "Origem inválida." }, { status: 400 })
  const source = body.source
  const note = await getNote(noteId)
  if (!note) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 })
  if (await isAdmin()) return NextResponse.json({ counted: false })

  const cookieName = directCookieName(noteId)
  if (source === "direct" && req.cookies.has(cookieName)) return NextResponse.json({ counted: false })
  const withinLimit = await rateLimit(
    `note-view:${source}:${requestIdentity(req)}`,
    { limit: source === "direct" ? 60 : 600, windowMs: 24 * 60 * 60_000 }
  )
  if (!withinLimit) return NextResponse.json({ counted: false }, { status: 429 })

  const result = await recordNoteView(noteId, visitorKey(req, noteId, source), source)
  if (source === "direct" && result.counted) {
    const [viewer, adminId] = await Promise.all([getAuthUser(), Promise.resolve(getAdminUserId())])
    if (adminId) {
      const title = note.seoTitle?.trim() || note.title?.trim() || noteDisplayTitle(note)
      const details = viewRequestDetails(req, body ?? {})
      if (viewer) {
        await createNotification({
          recipientId: adminId,
          actorId: viewer.id,
          actorImageUrl: viewer.imageUrl,
          kind: "view",
          title: `${viewer.name} abriu uma nota`,
          description: `“${title}” recebeu uma view real · ${result.metrics.directViews} no total.`,
          href: `/notes/${noteId}`,
        }, details).catch(() => undefined)
      } else {
        await aggregateNotification({
          recipientId: adminId,
          kind: "view",
          aggregateKey: `note-view:${noteId}`,
          title: `Novas views reais em uma nota`,
          description: `“${title}” chegou a ${result.metrics.directViews} views reais.`,
          href: `/notes/${noteId}`,
        }, details).catch(() => undefined)
      }
    }
  }

  const response = NextResponse.json({ counted: result.counted })
  if (source === "direct") {
    response.cookies.set(cookieName, "1", {
      httpOnly: true,
      maxAge: NOTE_VIEW_TTL_MS / 1000,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }
  return response
}
