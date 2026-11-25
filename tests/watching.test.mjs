import assert from "node:assert/strict"
import test from "node:test"
import { parseWatchingStatus, currentWatching } from "../src/lib/watching.ts"

const video = { title: "Dark", episode: "T1:E2 · Mentiras", cover: "https://occ-0-1.nflxso.net/cover.jpg", url: "https://www.netflix.com/watch/80100172" }
const now = Date.now()
const data = { current: { video, updatedAt: new Date(now).toISOString() } }

test("watching publishes only current video metadata and expires after 45 seconds", () => {
  assert.deepEqual(parseWatchingStatus({ secret: "private", current: { ...data.current, sessionId: "private", video: { ...video, token: "private" } } }), data)
  assert.deepEqual(currentWatching(data, now + 44_999), video)
  assert.equal(currentWatching(data, now + 45_000), null)
  assert.equal(currentWatching(data, now - 31_000), null)
  assert.equal(currentWatching(parseWatchingStatus({ current: null })), null)
})

test("watching accepts only Netflix or TVmaze artwork from the backend", () => {
  const cover = "https://static.tvmaze.com/uploads/images/medium_portrait/504/1262352.jpg"
  assert.equal(parseWatchingStatus({ current: { ...data.current, video: { ...video, cover } } }).current.video.cover, cover)
})

test("watching rejects invalid metadata, tracking URLs and untrusted images", () => {
  for (const value of [null, {}, { current: { video, updatedAt: "invalid" } }, ...[
    { title: " " }, { title: "a".repeat(501) }, { episode: null }, { cover: "javascript:alert(1)" },
    { cover: "https://nflxso.net.attacker.test/cover.jpg" }, { cover: "https://user:pass@occ.nflxso.net/x" },
    { cover: "https://static.tvmaze.com.attacker.test/uploads/images/x.jpg" }, { cover: "http://static.tvmaze.com/uploads/images/x.jpg" },
    { cover: "https://static.tvmaze.com/not-an-image" }, { cover: "https://static.tvmaze.com/uploads/images/x.jpg?token=private" },
    { url: "https://www.netflix.com/watch/123?token=private" }, { url: "https://netflix.com.attacker.test/watch/123" },
  ].map(change => ({ current: { ...data.current, video: { ...video, ...change } } }))]) assert.throws(() => parseWatchingStatus(value))
})
