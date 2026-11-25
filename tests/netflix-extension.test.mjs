import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { webcrypto } from "node:crypto"

const source = file => readFileSync(new URL(`../extensions/netflix/${file}`, import.meta.url), "utf8")

test("Netflix detector reads playback, caches hidden controls and resets on episode change", () => {
  const context = { URL }
  vm.runInNewContext(source("detector.js"), context)
  const read = context.NetflixWatching.read
  const video = { paused: false, ended: false, readyState: 4, poster: "https://occ.nflxso.net/cover.jpg" }
  let title = "Dark"
  const document = {
    querySelector(selector) { return selector.includes("video,") ? video : title ? { textContent: title } : null },
    querySelectorAll() { return [{ textContent: "T1:E2" }, { textContent: "Mentiras" }] }
  }
  const first = read(document, "https://www.netflix.com/watch/123?track=private", null, null)
  assert.equal(first.title, "Dark")
  assert.equal(first.episode, "T1:E2 · Mentiras")
  assert.equal(first.url, "https://www.netflix.com/watch/123")
  assert.equal(first.playing, true)
  title = ""
  assert.equal(read(document, first.url, null, first).title, "Dark")
  assert.equal(read(document, "https://www.netflix.com/watch/456", null, first), null)
  assert.equal(read(document, "https://www.netflix.com/browse", null, first), null)
  video.paused = true
  assert.equal(read(document, first.url, null, first).playing, false)
  video.paused = false
  video.readyState = 2
  assert.equal(read(document, first.url, null, first).playing, false)
  video.poster = "https://nflxso.net.attacker.test/x"
  assert.equal(read(document, first.url, null, first).cover, "")
})

test("extension worker authenticates only fixed API requests and preserves sessions across suspension", async () => {
  const sent = [], listeners = {}, stored = {}
  let badge, unavailable = false
  const chrome = {
    runtime: { id: "a".repeat(32), getURL: path => `chrome-extension://${"a".repeat(32)}/${path}`, onMessage: { addListener: fn => { listeners.message = fn } } },
    storage: { session: { async setAccessLevel() {}, async get() { return structuredClone(stored) }, async set(data) { Object.assign(stored, structuredClone(data)) } } },
    action: { async setBadgeText({ text }) { badge = text }, async setTitle() {}, onClicked: { addListener() {} } },
    tabs: { onRemoved: { addListener: fn => { listeners.removed = fn } }, onUpdated: { addListener: fn => { listeners.updated = fn } } }
  }
  const environment = { chrome, crypto: webcrypto, URL, AbortSignal, console,
    async fetch(url, options) {
      if (url.endsWith("config.json")) return Response.json({ apiOrigin: "https://domenyk-api.vercel.app", token: "a".repeat(64) })
      sent.push({ url, options, event: JSON.parse(options.body) })
      if (unavailable) throw new Error("offline")
      return Response.json({ ok: true })
    }
  }
  const boot = () => vm.runInNewContext(source("background.js"), { ...environment })
  boot()
  const sender = { id: chrome.runtime.id, frameId: 0, tab: { id: 1 }, url: "https://www.netflix.com/watch/123?track=private" }
  const snapshot = { title: "Dark", episode: "T1:E2", cover: "", url: "https://www.netflix.com/watch/123", playing: true }
  const message = (value = snapshot, origin = sender) => new Promise(resolve => listeners.message({ type: "netflix-playback", snapshot: value }, origin, resolve))
  await message()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].options.headers.Authorization, `Bearer ${"a".repeat(64)}`)
  assert.equal(sent[0].options.redirect, "error")
  assert.equal(sent[0].options.credentials, "omit")
  assert.equal(sent[0].url, "https://domenyk-api.vercel.app/v1/watching/events")
  const session = sent[0].event.sessionId
  assert.match(session, /^[a-f0-9]{64}$/)
  boot()
  await message()
  assert.equal(sent.at(-1).event.sessionId, session)
  assert.equal(sent.at(-1).event.sequence, 2)
  await message(null, { ...sender, tab: { id: 2 } })
  assert.equal(sent.length, 2)
  await message({ ...snapshot, title: "forged" }, { ...sender, url: "https://attacker.test/" })
  await message({ ...snapshot, url: "https://attacker.test/" })
  assert.equal(sent.length, 2)
  await message({ ...snapshot, playing: false })
  assert.equal(sent.at(-1).event.playing, false)
  unavailable = true
  assert.equal((await message()).ok, false)
  assert.equal(badge, "!")
  unavailable = false
  await message()
  assert.equal(badge, "ON")
  listeners.removed(1)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(sent.at(-1).event.playing, false)
})
