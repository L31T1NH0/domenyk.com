import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { seriesInputFromBody } from "@/lib/api/series-input"
import { deleteSeries, serializeSeries, updateSeries } from "@/lib/db/series"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  try {
    const { id } = await params
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const series = await updateSeries(id, seriesInputFromBody(body))
    if (!series) return NextResponse.json({ error: "Série não encontrada." }, { status: 404 })
    invalidatePublicContentCache()
    return NextResponse.json(serializeSeries(series))
  } catch (error) {
    const duplicate = typeof error === "object" && error && "code" in error && error.code === 11000
    return NextResponse.json(
      { error: duplicate ? "Já existe uma série com esse slug." : error instanceof Error ? error.message : "Não foi possível salvar a série." },
      { status: 400 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  if (!(await deleteSeries(id))) return NextResponse.json({ error: "Série não encontrada." }, { status: 404 })
  invalidatePublicContentCache()
  return NextResponse.json({ ok: true })
}
