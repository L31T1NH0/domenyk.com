import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import * as bridge from "../src/lib/bridge.ts"

test("bridge card polls without credentials, ticks elapsed time and hides on idle, expiry or errors", async () => {
  let effect, refresh, clock, cursor = 0, failed = false, now = Date.now(), payload = { current: null }, options
  const state = []
  const exports = {}
  const source = ts.transpileModule(readFileSync(new URL("../src/components/links/BridgeCard.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const jsx = (type, props) => ({ type, props })
  class Clock extends Date { static now() { return now } }
  vm.runInNewContext(source, {
    exports, Date: Clock, AbortController, AbortSignal,
    document: { visibilityState: "visible" },
    async fetch(_url, init) { options = init; if (failed) throw new Error("Offline"); return Response.json(payload) },
    setTimeout(callback) { refresh = callback; return 1 }, clearTimeout() {},
    setInterval(callback) { clock = callback; return 2 }, clearInterval() {},
    require(name) {
      if (name === "react") return { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial; return [state[index], value => { state[index] = value }] }, useEffect: callback => { effect ??= callback } }
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx }
      if (name === "@/lib/bridge") return bridge
      if (name === "./BridgeMatch") return { BridgeMatch: "bridge-match", MinecraftPresence: "minecraft-presence" }
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  const render = () => { cursor = 0; return exports.BridgeCard() }
  const flush = async callback => { callback(); await new Promise(setImmediate); return render() }
  assert.equal(render(), null)
  const cleanup = effect()
  await new Promise(setImmediate)
  const match = { red: { name: "Domenyk", score: 3 }, blue: { name: "Other", score: 2 }, elapsedSeconds: 139 }
  payload = { current: { match, updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 20_000).toISOString() } }
  let card = await flush(refresh)
  assert.equal(card.type, "bridge-match")
  assert.equal(card.props.red.name, "Domenyk")
  assert.equal(options.cache, "no-store")
  assert.equal(options.headers, undefined)
  now += 5000
  card = await flush(clock)
  assert.equal(card.props.elapsedSeconds, 144)
  match.blue.disconnected = true
  card = await flush(refresh)
  assert.equal(card.props.blue.disconnected, true)
  assert.equal(card.props.blue.name, "Other")
  assert.equal(card.props.blue.score, 2)
  payload = { current: { ...payload.current, activity: "waiting", match: null } }
  card = await flush(refresh)
  assert.equal(card.type, "minecraft-presence")
  assert.equal(card.props.waiting, true)
  payload = { current: { ...payload.current, activity: "minecraft" } }
  card = await flush(refresh)
  assert.equal(card.type, "minecraft-presence")
  assert.equal(card.props.waiting, false)
  now += 15_000
  assert.equal(await flush(clock), null)
  payload = { current: { match, updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 20_000).toISOString() } }
  assert.ok(await flush(refresh))
  payload = { current: null }
  assert.equal(await flush(refresh), null)
  failed = true
  assert.equal(await flush(refresh), null)
  cleanup()
  assert.equal(options.signal.aborted, true)
})
