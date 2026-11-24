import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import * as music from "../src/lib/music.ts"

test("music card stays hidden until a current track exists and hides after stop, expiry or failure", async () => {
  let state = null, effect, refresh, updated
  let payload = { current: null }, failed = false
  const exports = {}
  const source = ts.transpileModule(readFileSync(new URL("../src/components/links/MusicCard.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(source, {
    exports, AbortController, AbortSignal, Date,
    document: { visibilityState: "visible" },
    async fetch() { if (failed) throw new Error("Offline"); return Response.json(payload) },
    setTimeout(callback) { refresh = callback; return 1 }, clearTimeout() {},
    require(name) {
      if (name === "react") return { useState: () => [state, value => { state = value; updated?.() }], useEffect: callback => { effect ??= callback } }
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx }
      if (name === "@/lib/music") return music
      if (name.endsWith(".css")) return { default: {} }
      if (name.startsWith("@heroicons/")) return {}
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  async function tick(callback) {
    const changed = new Promise(resolve => { updated = resolve })
    callback()
    await changed
    await Promise.resolve()
    return exports.MusicCard()
  }
  assert.equal(exports.MusicCard(), null)
  let cleanup
  assert.equal(await tick(() => { cleanup = effect() }), null)
  const track = { id: "a".repeat(64), title: "Oceano", artist: "Djavan", cover: "" }
  payload = { current: { track, updatedAt: new Date().toISOString() } }
  const card = await tick(refresh)
  assert.equal(card.type, "a")
  assert.equal(card.props.href, music.youtubeMusicSearch(track.title))
  payload = { current: null }
  assert.equal(await tick(refresh), null)
  payload = { current: { track, updatedAt: new Date(Date.now() - 45_000).toISOString() } }
  assert.equal(await tick(refresh), null)
  payload = { current: { track, updatedAt: new Date().toISOString() } }
  assert.ok(await tick(refresh))
  failed = true
  assert.equal(await tick(refresh), null)
  cleanup()
})
