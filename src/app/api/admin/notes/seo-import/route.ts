import { after, NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"
import { notifyIndexNow } from "@/lib/indexnow"
import {
  applyNoteSeoImport,
  previewNoteSeoImport,
  validateNoteSeoImportBundle,
} from "@/lib/note-seo-import"

export const runtime = "nodejs"

const guide = [
  "# Importação de SEO das notas",
  "",
  "## Formato",
  "",
  "Envie um arquivo JSON com esta estrutura:",
  "",
  "```json",
  "{",
  '  "version": 1,',
  '  "kind": "domenyk_note_seo_import",',
  '  "notes": [',
  "    {",
  '      "id": "ID_MONGODB_DA_NOTA",',
  '      "seoTitle": "Título específico para a busca",',
  '      "seoDescription": "Descrição clara do conteúdo da nota, com contexto suficiente para aparecer no resultado."',
  "    }",
  "  ]",
  "}",
  "```",
  "",
  "## Regras do parser",
  "",
  "- `version` deve ser o número `1`.",
  "- `kind` deve ser `domenyk_note_seo_import`.",
  "- Cada `id` é o ObjectId da nota, encontrado na URL ou no painel administrativo.",
  "- Os IDs devem existir no site e não podem se repetir no arquivo.",
  "- `seoTitle` é obrigatório e aceita até 120 caracteres.",
  "- `seoDescription` é obrigatória e aceita até 300 caracteres.",
  "- O arquivo aceita até 500 notas.",
  "- A importação começa com uma prévia e só grava depois da confirmação.",
  "",
  "O título e a descrição são gravados exatamente depois de remover espaços no início e no fim. Uma nota só fica indexável quando os dois campos estão preenchidos.",
].join("\n")

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  return new NextResponse(guide, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="domenyk-note-seo-import.md"',
      "Cache-Control": "private, no-store",
    },
  })
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null) as { mode?: unknown; bundle?: unknown } | null
  try {
    const bundle = validateNoteSeoImportBundle(body?.bundle)
    if (body?.mode !== "apply") return NextResponse.json(await previewNoteSeoImport(bundle))
    const result = await applyNoteSeoImport(bundle)
    invalidatePublicContentCache()
    after(() => notifyIndexNow(result.noteIds.map((id) => `/notes/${id}`)).catch(() => undefined))
    return NextResponse.json({ ok: true, applied: result.applied })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar o SEO." }, { status: 400 })
  }
}
