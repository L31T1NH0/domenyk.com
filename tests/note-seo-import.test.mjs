import assert from "node:assert/strict"
import test from "node:test"

import { validateNoteSeoImportBundle } from "../src/lib/note-seo-format.ts"

const id = "507f1f77bcf86cd799439011"

test("validates the SEO import format and trims values", () => {
  const bundle = validateNoteSeoImportBundle({
    version: 1,
    kind: "domenyk_note_seo_import",
    notes: [{ id, seoTitle: "  Título  ", seoDescription: "  Descrição  " }],
  })
  assert.deepEqual(bundle.notes[0], { id, seoTitle: "Título", seoDescription: "Descrição" })
})

test("rejects duplicate or incomplete SEO records", () => {
  assert.throws(() => validateNoteSeoImportBundle({
    version: 1,
    kind: "domenyk_note_seo_import",
    notes: [{ id, seoTitle: "Título", seoDescription: "" }],
  }), /seoDescription não pode ficar vazio/)

  assert.throws(() => validateNoteSeoImportBundle({
    version: 1,
    kind: "domenyk_note_seo_import",
    notes: [
      { id, seoTitle: "Título", seoDescription: "Descrição" },
      { id, seoTitle: "Outro", seoDescription: "Outra descrição" },
    ],
  }), /aparece mais de uma vez/)
})
