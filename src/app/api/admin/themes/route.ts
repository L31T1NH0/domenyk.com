import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { themeInputFromBody } from "@/lib/api/theme-input"
import { createTheme, getThemes, serializeTheme } from "@/lib/db/themes"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  return NextResponse.json((await getThemes()).map(serializeTheme))
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const theme = await createTheme(themeInputFromBody(body))
    invalidatePublicContentCache()
    return NextResponse.json(serializeTheme(theme), { status: 201 })
  } catch (error) {
    const duplicate = typeof error === "object" && error && "code" in error && error.code === 11000
    return NextResponse.json(
      { error: duplicate ? "Já existe um tema com esse slug." : error instanceof Error ? error.message : "Não foi possível criar o tema." },
      { status: 400 }
    )
  }
}
