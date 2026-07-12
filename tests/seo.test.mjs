import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPageMetadata,
  noteDisplayTitle,
  titleFromMarkdown,
} from "../src/lib/seo.ts"

test("does not erase an inherited title when a page title is omitted", () => {
  const metadata = buildPageMetadata()
  assert.equal(Object.hasOwn(metadata, "title"), false)
  assert.equal(new URL(metadata.alternates.canonical).pathname, "/")
})

test("derives concise, markup-free titles for untitled notes", () => {
  const markdown = "## Segurança jurídica\n\n**Instituições** precisam de limites previsíveis para funcionar."
  assert.equal(titleFromMarkdown(markdown), "Segurança jurídica Instituições precisam de limites previsíveis para")
  assert.equal(noteDisplayTitle({ title: "  Título editorial  ", content: markdown }), "Título editorial")
  assert.equal(noteDisplayTitle({ content: markdown }), titleFromMarkdown(markdown))
})
