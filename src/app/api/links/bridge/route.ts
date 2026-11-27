import { publicLinkRequest } from "@/lib/links-api"
import { parseBridgeStatus } from "@/lib/bridge"

export async function GET() {
  try {
    return Response.json(parseBridgeStatus(await publicLinkRequest("/v1/bridge")), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Partida indisponível agora." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
