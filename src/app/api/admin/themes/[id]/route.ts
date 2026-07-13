import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { themeInputFromBody } from "@/lib/api/theme-input"
import { deleteTheme, serializeTheme, updateTheme } from "@/lib/db/themes"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  try {
    const { id } = await params
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const theme = await updateTheme(id, themeInputFromBody(body))
    if (!theme) return NextResponse.json({ error: "Tema não encontrado." }, { status: 404 })
    return NextResponse.json(serializeTheme(theme))
  } catch (error) {
    const duplicate = typeof error === "object" && error && "code" in error && error.code === 11000
    return NextResponse.json(
      { error: duplicate ? "Já existe um tema com esse slug." : error instanceof Error ? error.message : "Não foi possível salvar o tema." },
      { status: 400 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  if (!(await deleteTheme(id))) return NextResponse.json({ error: "Tema não encontrado." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
