import { NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { ensureDefaultThemes } from "@/lib/db/themes"

export async function POST() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  return NextResponse.json({ created: await ensureDefaultThemes() })
}
