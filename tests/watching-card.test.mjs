import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import * as watching from "../src/lib/watching.ts"

test("watching card hides on stop, expiry and failure, and removes stale state without another response", async () => {
  let state = null, effect, refresh, expiry, updated
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
      if (name === "react") return { useState: () => [state, value => { state = value; updated?.() }], useEffect: callback => { effect ??= callback } }
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx }
      if (name === "@/lib/watching") return watching
      if (name === "@/components/ThemeSwitcher") return { useThemeSwitcher: () => ({ darkMode: true }) }
      if (name === "@/astryx-themes") return { themes: { test: {} }, defaultThemeSlug: "test" }
      if (name.startsWith("@heroicons/") || name.startsWith("@astryxdesign/")) return {}
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  async function tick(callback) {
    const changed = new Promise(resolve => { updated = resolve })
    callback(); await changed; await Promise.resolve()
    return exports.WatchingCard()?.props.children ?? null
  }
  assert.equal(exports.WatchingCard(), null)
  let cleanup
  assert.equal(await tick(() => { cleanup = effect() }), null)
  const video = { title: "Dark", episode: "T1:E2", cover: "", url: "https://www.netflix.com/watch/123" }
  payload = { current: { video, updatedAt: new Date().toISOString() } }
  const card = await tick(refresh)
  assert.equal(card.type, "a")
  assert.equal(card.props.href, video.url)
  assert.match(card.props["aria-label"], /Dark, T1:E2/)
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
