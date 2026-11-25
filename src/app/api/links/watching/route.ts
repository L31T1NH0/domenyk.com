import { publicLinkRequest } from "@/lib/links-api"
import { parseWatchingStatus } from "@/lib/watching"

export async function GET() {
  try {
    return Response.json(parseWatchingStatus(await publicLinkRequest("/v1/watching")), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Reprodução indisponível agora." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
