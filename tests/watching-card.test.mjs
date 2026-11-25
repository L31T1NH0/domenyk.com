import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import * as watching from "../src/lib/watching.ts"

test("watching card hides on stop, expiry and failure, and removes stale state without another response", async () => {
  let effect, refresh, expiry, updated, hookIndex = 0
  const states = []
  let payload = { current: null }, failed = false
  const exports = {}
  const source = ts.transpileModule(readFileSync(new URL("../src/components/links/WatchingCard.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(source, {
    exports, AbortController, AbortSignal, Date,
    document: { visibilityState: "visible" },
    async fetch() { if (failed) throw new Error("Offline"); return Response.json(payload) },
    setTimeout(callback, delay) { if (delay === 15_000) refresh = callback; else expiry = callback; return 1 }, clearTimeout() {},
    require(name) {
      if (name === "react") return { useState: initial => {
        const index = hookIndex++
        if (!(index in states)) states[index] = initial
        return [states[index], value => { states[index] = value; updated?.() }]
      }, useEffect: callback => { effect ??= callback } }
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx }
      if (name === "@/lib/watching") return watching
      if (name === "@/components/ThemeSwitcher") return { useThemeSwitcher: () => ({ darkMode: true }) }
      if (name === "@/astryx-themes") return { themes: { test: {} }, defaultThemeSlug: "test" }
      if (name.startsWith("@heroicons/") || name.startsWith("@astryxdesign/")) return {}
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  function render() {
    hookIndex = 0
    return exports.WatchingCard()
  }
  function nodes(node) {
    if (!node || typeof node !== "object") return []
    return [node, ...[node.props?.children].flat().flatMap(nodes)]
  }
  async function tick(callback) {
    const changed = new Promise(resolve => { updated = resolve })
    callback(); await changed; await Promise.resolve()
    return render()?.props.children ?? null
  }
  assert.equal(render(), null)
  let cleanup
  assert.equal(await tick(() => { cleanup = effect() }), null)
  const video = { title: "Dark", episode: "T1:E2", cover: "", url: "https://www.netflix.com/watch/123" }
  payload = { current: { video, updatedAt: new Date().toISOString() } }
  const card = await tick(refresh)
  assert.equal(card.type, "a")
  assert.equal(card.props.href, video.url)
  assert.match(card.props["aria-label"], /Dark, T1:E2/)
  const fallback = node => node.props?.className === "size-6 text-neutral-500"
  assert.ok(nodes(card).some(fallback))
  video.cover = "https://static.tvmaze.com/uploads/images/first.jpg"
  let coveredCard = await tick(refresh)
  assert.equal(nodes(coveredCard).some(fallback), false)
  const image = nodes(coveredCard).find(node => node.type === "img")
  assert.equal(image.props.src, video.cover)
  image.props.onError()
  coveredCard = render()
  assert.ok(nodes(coveredCard).some(fallback))
  assert.equal(nodes(coveredCard).some(node => node.type === "img"), false)
  video.cover = "https://static.tvmaze.com/uploads/images/replacement.jpg"
  coveredCard = await tick(refresh)
  assert.equal(nodes(coveredCard).some(fallback), false)
  assert.equal(nodes(coveredCard).find(node => node.type === "img").props.src, video.cover)
  assert.equal(await tick(expiry), null)
  await tick(refresh)
  payload = { current: null }
  assert.equal(await tick(refresh), null)
  payload = { current: { video, updatedAt: new Date(Date.now() - 45_000).toISOString() } }
  assert.equal(await tick(refresh), null)
  failed = true
  assert.equal(await tick(refresh), null)
  cleanup()
})
