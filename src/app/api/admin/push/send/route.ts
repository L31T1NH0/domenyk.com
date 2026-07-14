import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { getNote } from "@/lib/db/notes"
import { getPostById } from "@/lib/db/posts"
import { sendReaderPush } from "@/lib/push"
import { asString } from "@/lib/validation"

export async function POST(req: NextRequest) {
  const denied = await adminOnly()
  if (denied) return denied
  const body = await req.json().catch(() => null) as {
    contentType?: unknown
    contentId?: unknown
    title?: unknown
    message?: unknown
    requestId?: unknown
  } | null
  const contentType = body?.contentType === "post" || body?.contentType === "note" ? body.contentType : null
  const contentId = asString(body?.contentId, 120)
  const requestId = asString(body?.requestId, 80) ?? randomUUID()
  const customTitle = asString(body?.title, 120)?.trim()
  const customMessage = asString(body?.message, 240)?.trim()
  if (!contentType || !contentId || !customTitle || !customMessage) {
    return NextResponse.json({ error: "Conteúdo, título e mensagem são obrigatórios." }, { status: 400 })
  }

  let url: string
  if (contentType === "post") {
    const post = await getPostById(contentId)
    if (!post?.published) return NextResponse.json({ error: "Escolha um post publicado." }, { status: 400 })
    url = `/posts/${post.slug}`
  } else {
    const note = await getNote(contentId)
    if (!note) return NextResponse.json({ error: "Escolha uma nota publicada." }, { status: 400 })
    url = `/notes/${note._id.toString()}`
  }

  const result = await sendReaderPush({
    dedupeKey: `manual:${requestId}`,
    source: "manual",
    topic: contentType === "post" ? "posts" : "notes",
    contentType,
    contentId,
    title: customTitle,
    body: customMessage,
    url,
  })
  if (!result.configured) {
    return NextResponse.json({ error: "Configure as chaves VAPID antes de enviar." }, { status: 503 })
  }
  if (result.deduplicated) {
    return NextResponse.json({ error: "Este disparo já foi processado." }, { status: 409 })
  }
  return NextResponse.json({ ok: true, sent: result.sentCount, failed: result.failedCount })
}
