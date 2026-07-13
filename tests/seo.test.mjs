import assert from "node:assert/strict"
import test from "node:test"

import {
  authorJsonLd,
  buildPageMetadata,
  imageUrlsFromMarkdown,
  isNoteIndexable,
  noteDisplayTitle,
  preferredContentImages,
  titleFromMarkdown,
} from "../src/lib/seo.ts"

test("only makes a note indexable when both explicit SEO fields are filled", () => {
  assert.equal(isNoteIndexable({}), false)
  assert.equal(isNoteIndexable({ seoTitle: "Título", seoDescription: "   " }), false)
  assert.equal(isNoteIndexable({ seoTitle: " Título ", seoDescription: " Descrição " }), true)
})

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

test("uses one stable, fully described author entity", () => {
  const author = authorJsonLd()
  assert.equal(author["@type"], "Person")
  assert.match(author["@id"], /\/#person$/)
  assert.equal(new URL(author.url).pathname, "/sobre")
  assert.equal(author.name, "Domenyk")
  assert.deepEqual(author.sameAs, ["https://www.instagram.com/dome.nyk_/"])
})

test("deduplicates cover and body images while preserving their discovery order", () => {
  const markdown = "![Capa](https://images.example/capa.webp)\n\n![Gráfico](https://images.example/grafico.png)"
  assert.deepEqual(imageUrlsFromMarkdown(markdown), [
    "https://images.example/capa.webp",
    "https://images.example/grafico.png",
  ])
  assert.deepEqual(preferredContentImages({
    cover: "https://images.example/capa.webp",
    images: ["https://images.example/galeria.jpg"],
    markdown,
  }), [
    "https://images.example/capa.webp",
    "https://images.example/galeria.jpg",
    "https://images.example/grafico.png",
  ])
})
