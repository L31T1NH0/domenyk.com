import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import * as linkPage from "../src/lib/link-page.ts"
import * as links from "../src/lib/links.ts"
import * as postLocales from "../src/lib/post-locales.ts"

// Run the extracted state/actions without mounting any of the deleted UI.
function hookModule(file, dependencies = {}, globals = {}) {
  const cells = []
  let cursor = 0
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial
      return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value }]
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0] },
    useMemo(compute) { return compute() },
    useCallback(callback) { return callback },
    useEffect() {},
    useId() { return "test-id" },
  }
  const exports = {}
  const source = readFileSync(new URL(file, import.meta.url), "utf8")
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, {
    exports,
    Response,
    crypto,
    ...globals,
    require(name) {
      if (name === "react") return react
      if (name in dependencies) return dependencies[name]
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  return (name, props) => { cursor = 0; return exports[name](props) }
}

test("writing actions retain validation and completion payloads without UI", async () => {
  const requests = []
  let saved
  const render = hookModule("../src/app/admin/escrevendo/useWritingManager.ts", {}, {
    async fetch(url, options) { requests.push({ url, ...options }); return Response.json({}) },
  })
  const props = { entry: { id: "entry-1", title: "Texto", progress: 45, completed: false }, onSaved(value) { saved = value } }
  let state = render("useWritingForm", props)
  state.setProgress("101")
  state = render("useWritingForm", props)
  await state.save()
  assert.equal(requests.length, 0)
  assert.match(render("useWritingForm", props).error, /entre 0 e 100/)

  state.setProgress("100")
  state = render("useWritingForm", props)
  await state.save(true)
  assert.equal(requests[0].url, "/api/admin/writing/entry-1")
  assert.equal(requests[0].method, "PATCH")
  assert.deepEqual(JSON.parse(requests[0].body), { title: "Texto", progress: 100, completed: true })
  assert.equal(saved.completed, true)
})

test("link curation retains selection, duplicate checks and occupied-section protection", () => {
  const render = hookModule("../src/app/admin/links/useLinksManager.ts", {
    "@/lib/link-page": linkPage,
    "@/lib/links": links,
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "./useLinkEditorControls": {},
  })
  const props = {
    links: [{ section: "content" }],
    settings: null,
    pageData: { featured: [], readings: [] },
    catalog: [],
    latest: null,
  }
  let state = render("useLinksManager", props)
  state.removeSection("content")
  assert.equal(render("useLinksManager", props).settings.sections.length, 1)
  state.setPicker("readings")
  state = render("useLinksManager", props)
  const content = { kind: "post", id: "post-1", title: "Texto", description: "Resumo", cover: "", coverAlt: "", url: "/posts/texto" }
  state.selectContent(content)
  state = render("useLinksManager", props)
  assert.equal(state.settings.readings.length, 1)
  state.setPicker("readings")
  state = render("useLinksManager", props)
  state.selectContent(content)
  state = render("useLinksManager", props)
  assert.equal(state.settings.readings.length, 1)
  assert.match(state.error, /já está/)
})

test("cover actions retain library pagination and image selection", async () => {
  const urls = []
  let selected
  const render = hookModule("../src/app/admin/links/useLinkEditorControls.ts", {}, {
    async fetch(url) {
      urls.push(url)
      return Response.json(urls.length === 1 ? { items: [{ url: "image-1" }], cursor: "next page" } : { items: [{ url: "image-2" }], cursor: null })
    },
  })
  const props = { url: "", alt: "Descrição", onChange(url, alt) { selected = { url, alt } } }
  let state = render("useCoverField", props)
  await state.toggleLibrary()
  state = render("useCoverField", props)
  await state.loadMoreImages()
  state = render("useCoverField", props)
  assert.equal(state.library.length, 2)
  assert.equal(urls[1], "/api/admin/links/media?cursor=next%20page")
  state.selectImage("image-2")
  assert.deepEqual(selected, { url: "image-2", alt: "Descrição" })
  assert.equal(render("useCoverField", props).library, null)
})

test("editing push content invalidates the previous confirmation", () => {
  const render = hookModule("../src/app/admin/notificacoes/useManualPushComposer.ts")
  const props = { content: [{ id: "post-1", type: "post", title: "Texto", description: "Resumo", href: "/posts/texto" }] }
  let state = render("useManualPushComposer", props)
  state.review()
  state = render("useManualPushComposer", props)
  assert.equal(state.confirming, true)
  state.changeMessage("Mensagem alterada")
  state = render("useManualPushComposer", props)
  assert.equal(state.confirming, false)
  assert.equal(state.message, "Mensagem alterada")
})

test("post actions preserve manual slugs and save translations separately", async () => {
  const requests = []
  const render = hookModule("../src/components/editor/usePostEditor.ts", {
    "@/lib/post-locales": postLocales,
    "./LexicalEditor": {},
  }, {
    async fetch(url, options) {
      requests.push({ url, ...options })
      return Response.json({ translation: { published: false, sourceUpdatedAt: "2026-11-23T00:00:00.000Z" } })
    },
  })
  const props = { post: { id: "post-1", title: "Original", content: "Texto original", slug: "original", tags: [], style: "standard" } }
  let state = render("usePostEditor", props)
  state.handleSlugChange("endereco-manual")
  state = render("usePostEditor", props)
  state.handleTitleChange("Outro título")
  state = render("usePostEditor", props)
  assert.equal(state.slug, "endereco-manual")
  state.selectLocale("en")
  state = render("usePostEditor", props)
  state.handleTitleChange("English title")
  state.updateActiveDraft({ content: "English content" })
  state = render("usePostEditor", props)
  await state.save(false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "/api/admin/posts/post-1")
  assert.equal(requests[0].method, "PATCH")
  const payload = JSON.parse(requests[0].body)
  assert.equal(payload.locale, "en")
  assert.equal(payload.slug, "english-title")
  assert.equal(payload.content, "English content")
  assert.equal(payload.published, false)
  assert.equal("style" in payload, false)
  assert.equal(render("usePostEditor", props).error, "")
})
