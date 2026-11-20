import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { getPostById } from "@/lib/db/posts"
import { setThemesForPost } from "@/lib/db/themes"
import { asStringArray, toObjectId } from "@/lib/validation"
import { goAdminErrorResponse, usesGoAdmin, writeGoAdminPost } from "@/lib/go-admin-posts"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (usesGoAdmin()) {
    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.themeIds)) return NextResponse.json({ error: "Seleção de temas inválida." }, { status: 400 })
    try {
      return NextResponse.json(await writeGoAdminPost("PATCH", id, { themeIds: body.themeIds }), { headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return goAdminErrorResponse(error) }
  }
  const post = await getPostById(id)
  if (!post) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 })

  const body = await req.json().catch(() => null) as { themeIds?: unknown } | null
  const themeIds = asStringArray(body?.themeIds, 200, 24).map(toObjectId)
  if (themeIds.some((themeId) => !themeId)) {
    return NextResponse.json({ error: "Seleção de temas inválida." }, { status: 400 })
  }

  try {
    await setThemesForPost(post._id, themeIds as NonNullable<(typeof themeIds)[number]>[])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar os temas." }, { status: 400 })
  }
}
