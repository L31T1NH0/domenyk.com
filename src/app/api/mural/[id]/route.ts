import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { deletePersonalUpdate, editPersonalUpdate } from "@/lib/db/personal-timeline"
import { personalUpdateContent } from "@/lib/personal-timeline"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Publicação inválida." }, { status: 400 })
  const content = personalUpdateContent(await req.json().catch(() => null))
  if (!content) return NextResponse.json({ error: "A publicação está vazia ou ultrapassou 300.000 caracteres." }, { status: 400 })
  const item = await editPersonalUpdate(id, content)
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 })
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Publicação inválida." }, { status: 400 })
  return await deletePersonalUpdate(id)
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 })
}
