import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import * as seo from "../src/lib/seo.ts"
import * as links from "../src/lib/links.ts"
import * as linkPage from "../src/lib/link-page.ts"
import * as goAdmin from "../src/lib/go-admin.ts"

const id = "0123456789abcdef01234567"
const card = { kind: "note", id, title: "Uma nota", description: "Resumo", url: `/notes/${id}`, cover: "", coverAlt: "", publishedAt: "2026-11-24T12:00:00Z" }
function load(note) {
  const exports = {}
  const dependencies = {
    "server-only": {}, "./db/notes": { getNote: async () => note }, "./seo": seo,
    "react": { cache: fn => fn }, "@clerk/nextjs/server": {},
    "./go-admin": goAdmin, "./links": links, "./link-page": linkPage,
  }
  const source = ts.transpileModule(readFileSync(new URL("../src/lib/links-api.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, { exports, require: name => dependencies[name] })
  return exports.getLinkContents
}

test("note cards use gallery, Markdown or HTML images as their original cover", async () => {
  for (const note of [
    { content: "Texto da nota", images: ["https://example.com/gallery.jpg"] },
    { content: "Texto da nota ![Imagem](https://example.com/markdown.jpg)" },
    { content: '<p>Texto da nota</p><img src="https://example.com/html.jpg">' },
  ]) {
    const [result] = await load(note)([card])
    assert.match(result.cover, /^https:\/\/example.com\//)
    assert.match(result.content, /Texto da nota/)
    assert.equal(result.coverAlt, card.title)
  }
})
test("note images preserve custom covers and an explicit choice of no cover", async () => {
  const getContents = load({ content: "![Imagem](https://example.com/original.jpg)" })
  const selection = linkPage.contentSelection(card)
  const [hidden] = await getContents([card], [{ ...selection, coverMode: "none" }])
  assert.equal(hidden.cover, "")
  const [custom] = await getContents([{ ...card, cover: "https://example.com/custom.jpg" }], [{ ...selection, coverMode: "custom", cover: "https://example.com/custom.jpg" }])
  assert.equal(custom.cover, "https://example.com/custom.jpg")
})
test("missing notes and unsafe image sources do not create a cover", async () => {
  for (const note of [null, { content: "Sem imagem" }, { content: '<img src="javascript:alert(1)">' }]) {
    const [result] = await load(note)([card])
    assert.equal(result.cover, "")
  }
})
