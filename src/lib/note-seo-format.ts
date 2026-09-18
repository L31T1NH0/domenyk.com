export type NoteSeoImportItem = {
  id: string
  seoTitle: string
  seoDescription: string
}

export type NoteSeoImportBundle = {
  version: 1
  kind: "domenyk_note_seo_import"
  notes: NoteSeoImportItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} deve ser texto.`)
  const result = value.trim()
  if (!result) throw new Error(`${field} não pode ficar vazio.`)
  if (result.length > maxLength) throw new Error(`${field} excede o limite de ${maxLength} caracteres.`)
  return result
}

export function validateNoteSeoImportBundle(value: unknown): NoteSeoImportBundle {
  if (!isRecord(value) || value.version !== 1 || value.kind !== "domenyk_note_seo_import") {
    throw new Error("Arquivo SEO inválido. Use o formato descrito no guia.")
  }
  if (!Array.isArray(value.notes) || value.notes.length === 0 || value.notes.length > 500) {
    throw new Error("O arquivo deve conter entre 1 e 500 notas.")
  }

  const ids = new Set<string>()
  const notes = value.notes.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`A nota ${index + 1} é inválida.`)
    const id = requiredString(raw.id, `notes[${index}].id`, 24)
    if (!/^[a-f\d]{24}$/i.test(id)) throw new Error(`notes[${index}].id não é um ObjectId válido.`)
    if (ids.has(id)) throw new Error(`O ID ${id} aparece mais de uma vez.`)
    ids.add(id)
    return {
      id,
      seoTitle: requiredString(raw.seoTitle, `notes[${index}].seoTitle`, 120),
      seoDescription: requiredString(raw.seoDescription, `notes[${index}].seoDescription`, 300),
    }
  })

  return { version: 1, kind: "domenyk_note_seo_import", notes }
}
