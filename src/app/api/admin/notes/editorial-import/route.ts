import { after, NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import {
  applyEditorialImport,
  previewEditorialImport,
  validateEditorialImportBundle,
} from "@/lib/editorial-import"
import { notifyIndexNow } from "@/lib/indexnow"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as { mode?: unknown; bundle?: unknown } | null
  const mode = body?.mode === "apply" ? "apply" : "preview"

  try {
    const bundle = validateEditorialImportBundle(body?.bundle)
    if (mode === "preview") {
      return NextResponse.json(await previewEditorialImport(bundle))
    }

    const preview = await previewEditorialImport(bundle)
    if (!preview.canApply) {
      return NextResponse.json({ error: "A prévia encontrou correspondências inseguras.", preview }, { status: 409 })
    }
    const result = await applyEditorialImport(bundle)
    invalidatePublicContentCache()
    after(() => notifyIndexNow(result.changedNoteIds.map((id) => `/notes/${id}`)).catch(() => undefined))
    return NextResponse.json({ ok: true, applied: result.changedNoteIds.length, preview })
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : ""
    const blocked = error instanceof Error && "blocked" in error ? error.blocked : undefined
    const status = code === "EDITORIAL_IMPORT_CONFLICT" ? 409 : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível processar o pacote.", blocked }, { status })
  }
}
