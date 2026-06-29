import { NextRequest, NextResponse } from "next/server"
import { updatePost, deletePost, publishPost } from "@/lib/db/posts"
import { adminOnly } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"
import { parsePostPatch } from "@/lib/api/post-input"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 })

  try {
    const data = parsePostPatch(body)
    if (body.cover === null) data.showCoverInTimeline = false

    if (Object.keys(data).length > 0) {
      await updatePost(id, data)
    }

    if ("published" in body) {
      await publishPost(id, body.published === true)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message.includes("inválido")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Slug ou publicId já existe." }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const deleted = await deletePost(id)
  if (!deleted) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
