import { getNote, updateNoteSeo } from "./db/notes"
import { validateNoteSeoImportBundle, type NoteSeoImportBundle, type NoteSeoImportItem } from "./note-seo-format"
export { validateNoteSeoImportBundle }
export type { NoteSeoImportBundle, NoteSeoImportItem }

export type NoteSeoImportPreviewItem = NoteSeoImportItem & {
  status: "update" | "unchanged" | "missing"
  detail?: string
}

export async function previewNoteSeoImport(bundle: NoteSeoImportBundle) {
  const items: NoteSeoImportPreviewItem[] = []
  for (const item of bundle.notes) {
    const note = await getNote(item.id)
    if (!note) {
      items.push({ ...item, status: "missing", detail: "Nota não encontrada." })
      continue
    }
    const unchanged = note.seoTitle?.trim() === item.seoTitle && note.seoDescription?.trim() === item.seoDescription
    items.push({ ...item, status: unchanged ? "unchanged" : "update" })
  }
  return {
    canApply: items.every((item) => item.status !== "missing"),
    counts: {
      total: items.length,
      update: items.filter((item) => item.status === "update").length,
      unchanged: items.filter((item) => item.status === "unchanged").length,
      missing: items.filter((item) => item.status === "missing").length,
    },
    items,
  }
}

export async function applyNoteSeoImport(bundle: NoteSeoImportBundle) {
  const preview = await previewNoteSeoImport(bundle)
  if (!preview.canApply) throw new Error("A importação foi bloqueada porque existem notas não encontradas.")
  let applied = 0
  for (const item of bundle.notes) {
    const note = await updateNoteSeo(item.id, item)
    if (!note) throw new Error(`A nota ${item.id} não pôde ser atualizada.`)
    applied += 1
  }
  return { applied, noteIds: bundle.notes.map((item) => item.id) }
}
