import assert from "node:assert/strict"
import test from "node:test"
import { parseMusicStatus, currentMusic, youtubeMusicSearch } from "../src/lib/music.ts"

const track = { id: "a".repeat(64), title: "Oceano", artist: "Djavan", cover: "https://is1-ssl.mzstatic.com/cover.jpg" }
const data = { current: { track, updatedAt: "2026-11-23T12:00:00Z" } }

test("only current track metadata is exposed, without ranking or audio sources", () => {
  assert.deepEqual(parseMusicStatus({ ...data, top: [{ track, plays: 10 }], secret: "ignored", current: { ...data.current, track: { ...track, token: "ignored", previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a", catalogUrl: "https://music.apple.com/track/123" } } }), data)
  assert.deepEqual(parseMusicStatus({ current: null, top: [{ track, plays: 10 }] }), { current: null })
})
test("current track expires and does not fall back to listening history", () => {
  assert.deepEqual(currentMusic(data, Date.parse("2026-11-23T12:00:10Z")), track)
  assert.equal(currentMusic(data, Date.parse("2026-11-23T12:00:45Z")), null)
  assert.equal(currentMusic({ current: null }), null)
})
test("invalid current metadata and unsafe covers are rejected", () => {
  for (const value of [null, {}, { current: { track, updatedAt: "invalid" } }, ...[
    { id: "invalid" }, { title: "" }, { artist: null }, { cover: "javascript:alert(1)" }, { cover: "https://user:password@example.com/cover.jpg" },
  ].map(change => ({ current: { ...data.current, track: { ...track, ...change } } }))]) assert.throws(() => parseMusicStatus(value))
})
test("YouTube search encodes the complete title as a single query value", () => {
  const title = "AC/DC & Elis — Oração? #ao vivo"
  const url = new URL(youtubeMusicSearch(title))
  assert.equal(url.origin, "https://www.youtube.com")
  assert.equal(url.pathname, "/results")
  assert.deepEqual([...url.searchParams], [["search_query", title]])
})
