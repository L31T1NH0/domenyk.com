import { adminOnly } from "@/lib/auth"
import { renderMarkdown } from "@/lib/mdx"
import { MAX_RICH_CONTENT_LENGTH } from "@/lib/content-format"
import { compilePublicationCss, extractPublicationCss } from "@/lib/publication-css"

export async function POST(request: Request) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  if (Number(request.headers.get("content-length")) > MAX_RICH_CONTENT_LENGTH * 4) return Response.json({ error: "Conteúdo muito longo." }, { status: 413 })
  const body = await request.json().catch(() => null)
  if (typeof body?.content !== "string" || body.content.length > MAX_RICH_CONTENT_LENGTH) return Response.json({ error: "Conteúdo inválido." }, { status: 400 })
  try {
    compilePublicationCss(extractPublicationCss(body.content), "[data-preview]")
    return Response.json({ html: await renderMarkdown(body.content) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível gerar a prévia." }, { status: 400 })
  }
}
