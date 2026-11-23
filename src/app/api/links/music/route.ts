import { publicLinkRequest } from "@/lib/links-api"
import { parseMusicStatus } from "@/lib/music"

export async function GET() {
  try {
    return Response.json(parseMusicStatus(await publicLinkRequest("/v1/music")), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Músicas indisponíveis agora." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
