import { NextResponse } from "next/server"
import { getLatestGoNote } from "@/lib/links-api"

export async function GET() {
  try {
    return NextResponse.json(await getLatestGoNote(), { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } })
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a última nota." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
