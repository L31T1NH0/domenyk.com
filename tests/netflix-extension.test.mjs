import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { webcrypto } from "node:crypto"
import { readNetflixPlayer } from "../extensions/netflix/player.mjs"

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
  assert.equal(read(document, first.url, null, first).playing, true)
  video.paused = false
  video.readyState = 2
  assert.equal(read(document, first.url, null, first).playing, true)
  video.ended = true
  assert.equal(read(document, first.url, null, first).playing, false)
  video.ended = false
  video.poster = "https://nflxso.net.attacker.test/x"
  assert.equal(read(document, first.url, null, first).cover, "")
})

test("extension worker authenticates only fixed API requests and preserves sessions across suspension", async () => {
  const sent = [], listeners = {}, stored = {}
  let badge, unavailable = false
  const chrome = {
    runtime: { id: "a".repeat(32), getURL: path => `chrome-extension://${"a".repeat(32)}/${path}`, onMessage: { addListener: fn => { listeners.message = fn } }, onInstalled: { addListener: fn => { listeners.installed = fn } }, onStartup: { addListener: fn => { listeners.startup = fn } } },
    storage: { session: { async setAccessLevel() {}, async get() { return structuredClone(stored) }, async set(data) { Object.assign(stored, structuredClone(data)) } } },
    action: { async setBadgeText({ text }) { badge = text }, async setTitle() {}, onClicked: { addListener() {} } },
    scripting: { async executeScript() { return [{ result: null }] } },
    alarms: { async get() {}, async create() {}, async clear() {}, onAlarm: { addListener: fn => { listeners.alarm = fn } } },
    tabs: { async query() { return [] }, onRemoved: { addListener: fn => { listeners.removed = fn } }, onUpdated: { addListener: fn => { listeners.updated = fn } } }
  }
  const environment = { chrome, crypto: webcrypto, URL, AbortSignal, console, readNetflixPlayer,
    async fetch(url, options) {
      if (url.endsWith("config.json")) return Response.json({ apiOrigin: "https://domenyk-api.vercel.app", token: "a".repeat(64) })
      sent.push({ url, options, event: JSON.parse(options.body) })
      if (unavailable) throw new Error("offline")
      return Response.json({ ok: true })
    }
  }
  const boot = () => vm.runInNewContext(source("background.js").replace(/^import .*\n/, ""), { ...environment })
  boot()
  assert.equal(typeof listeners.installed, "function")
  assert.equal(typeof listeners.startup, "function")
  assert.equal(typeof listeners.alarm, "function")
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
  chrome.scripting.executeScript = async options => {
    assert.equal(options.world, "MAIN")
    assert.equal(options.func, readNetflixPlayer)
    assert.equal(options.args, undefined)
    return [{ result: { ...snapshot, title: "Title without visible controls", account: "must not leave the page" } }]
  }
  await message(null)
  assert.equal(sent.at(-1).event.title, "Title without visible controls")
  assert.equal(sent.at(-1).event.account, undefined)
  listeners.removed(1)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(sent.at(-1).event.playing, false)
  let alarm
  const injections = []
  chrome.alarms.get = async () => alarm
  chrome.alarms.create = async (name, options) => { alarm = { name, ...options } }
  chrome.alarms.clear = async () => { alarm = undefined }
  chrome.tabs.query = async () => [{ id: 42 }]
  chrome.scripting.executeScript = async options => { injections.push(options); return [] }
  listeners.alarm({ name: "netflix-presence" })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(alarm.periodInMinutes, 0.5)
  assert.deepEqual([...injections[0].files], ["detector.js", "content.js"])
  chrome.tabs.query = async () => []
  listeners.alarm({ name: "netflix-presence" })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(alarm, undefined)
})

test("MAIN-world probe recognizes Netflix with no visible title and caches only current metadata", async () => {
  const video = { paused: false, ended: false, readyState: 4, poster: "" }
  let calls = 0
  const playback = { videoId: 123, playing: true, paused: false, duration: 100 }
  const context = {
    URL, AbortSignal, Date,
    location: { origin: "https://www.netflix.com", pathname: "/watch/123" },
    document: { querySelector: selector => selector.includes("video,") ? video : null, querySelectorAll: () => [] },
    navigator: {},
    netflix: { appContext: { state: { playerApp: { getState: () => ({ videoPlayer: { playbackStateBySessionId: { current: playback } } }) } } } },
    async fetch(url, options) {
      calls++
      assert.equal(url.origin, "https://www.netflix.com")
      assert.equal(url.pathname, "/nq/website/memberapi/release/metadata")
      assert.equal(url.searchParams.get("movieid"), String(playback.videoId))
      assert.equal(options.credentials, "same-origin")
      assert.equal(options.redirect, "error")
      assert.equal(url.searchParams.has("authURL"), false)
      return Response.json({ video: { title: "Dark", id: 999, currentEpisode: 456, seasons: [{ seq: 1, episodes: [{ id: 123, seq: 2, title: "Lies" }, { id: 456, seq: 3, title: "Past and Present" }] }] } })
    }
  }
  vm.createContext(context)
  const read = () => vm.runInContext(`(${readNetflixPlayer.toString()})()`, context)
  const first = await read()
  assert.equal(first.title, "Dark")
  assert.equal(first.episode, "T1:E2 · Lies")
  assert.equal(first.playing, true)
  assert.equal(first.url, "https://www.netflix.com/watch/123")
  video.paused = true
  assert.equal((await read()).playing, true, "Netflix playback state takes priority over an unrelated paused video element")
  playback.paused = true
  playback.playing = false
  assert.equal((await read()).playing, true, "pausing keeps the episode present")
  video.ended = true
  assert.equal((await read()).playing, false)
  video.ended = false
  assert.equal(calls, 1)
  assert.deepEqual(Object.keys(context.__domenykWatchingMetadata).sort(), ["cover", "episode", "id", "retryAt", "title"])
  context.location.pathname = "/watch/456"
  playback.videoId = 456
  assert.equal((await read()).episode, "T1:E3 · Past and Present")
  assert.equal(calls, 2)
  context.location.pathname = "/browse"
  assert.equal(await read(), null)
})

test("reinjecting the reporter replaces timers and event listeners rather than duplicating them", () => {
  const timers = new Set(), events = new Map()
  let sent = 0, id = 0
  const target = { addEventListener(name, fn) { const set = events.get(name) || new Set(); set.add(fn); events.set(name, set) }, removeEventListener(name, fn) { events.get(name)?.delete(fn) } }
  const context = {
    document: target, window: target, location: { href: "https://www.netflix.com/watch/123" }, navigator: {}, Date,
    NetflixWatching: { read: () => null },
    chrome: { runtime: { id: "extension", sendMessage: () => { sent++; return Promise.resolve({ ok: true }) } } },
    setTimeout() { timers.add(++id); return id }, clearTimeout(value) { timers.delete(value) }
  }
  vm.createContext(context)
  vm.runInContext(source("content.js"), context)
  vm.runInContext(source("content.js"), context)
  assert.equal(sent, 2)
  assert.equal(timers.size, 1)
  for (const listeners of events.values()) assert.equal(listeners.size, 1)
  for (const listener of events.get("pause")) listener({ type: "pause" })
  assert.equal(sent, 3, "a pause must probe MAIN even when the DOM snapshot stays null")
})

test("Media Session remains usable when Netflix metadata is unavailable and its album is generic", async () => {
  let calls = 0
  const context = {
    URL, AbortSignal, Date,
    location: { origin: "https://www.netflix.com", pathname: "/watch/123" },
    navigator: { mediaSession: { metadata: { album: "Netflix", title: "Dark", artwork: [{ src: "https://attacker.test/x.jpg" }] } } },
    document: { querySelector: selector => selector.includes("video,") ? { paused: false, ended: false, readyState: 4 } : null, querySelectorAll: () => [] },
    async fetch() { calls++; return new Response("", { status: 401 }) }
  }
  vm.createContext(context)
  const read = () => vm.runInContext(`(${readNetflixPlayer.toString()})()`, context)
  const snapshot = await read()
  assert.equal(snapshot.title, "Dark")
  assert.equal(snapshot.playing, true)
  assert.equal(snapshot.cover, "")
  await read()
  assert.equal(calls, 1)
})
