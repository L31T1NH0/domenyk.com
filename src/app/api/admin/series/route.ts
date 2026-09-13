import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { seriesInputFromBody } from "@/lib/api/series-input"
import { createSeries, getSeries, serializeSeries } from "@/lib/db/series"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  return NextResponse.json((await getSeries()).map(serializeSeries))
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const series = await createSeries(seriesInputFromBody(body))
    invalidatePublicContentCache()
    return NextResponse.json(serializeSeries(series), { status: 201 })
  } catch (error) {
    const duplicate = typeof error === "object" && error && "code" in error && error.code === 11000
    return NextResponse.json(
      { error: duplicate ? "Já existe uma série com esse slug." : error instanceof Error ? error.message : "Não foi possível criar a série." },
      { status: 400 }
    )
  }
}
