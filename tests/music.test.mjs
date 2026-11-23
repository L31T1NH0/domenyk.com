import assert from "node:assert/strict"
import test from "node:test"
import { parseMusicStatus, musicQueue, musicTime, nextMusicIndex } from "../src/lib/music.ts"

const track = { id: "a".repeat(64), title: "Oceano", artist: "Djavan", cover: "https://is1-ssl.mzstatic.com/cover.jpg", url: "https://youtube.com/watch?v=abcdefghijk", previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a", catalogUrl: "https://music.apple.com/br/album/track/123" }
const top = Array.from({ length: 15 }, (_, index) => ({ track: { ...track, id: (index + 1).toString(16).padStart(64, "0") }, plays: 100 - index }))
const data = { current: { track, updatedAt: "2026-11-23T12:00:00Z" }, top }

test("queue contains current plus fifteen other songs, expires current and accepts empty history", () => {
  const status = parseMusicStatus(data)
  const entries = musicQueue(status, Date.parse("2026-11-23T12:00:10Z"))
  assert.equal(entries.length, 16)
  assert.equal(entries[0].current, true)
  assert.equal(entries[1].current, false)
  assert.equal(musicQueue(status, Date.parse("2026-11-23T12:00:45Z")).length, 15)
  assert.deepEqual(musicQueue(parseMusicStatus({ current: null, top: [] })), [])
})
test("public metadata rejects unsafe sources, malformed counts, duplicate songs and oversized rankings", () => {
  for (const change of [
    { top: [...top, top[0]] },
    { top: [top[0], top[0]] },
    { top: [{ ...top[0], plays: -1 }] },
    { current: { track, updatedAt: "invalid" } },
    { current: { ...data.current, track: { ...track, cover: "javascript:alert(1)" } } },
    { current: { ...data.current, track: { ...track, previewUrl: "https://apple.com.attacker.test/track.mp3" } } },
    { current: { ...data.current, track: { ...track, previewUrl: "https://evil.test/track.mp3" } } },
    { current: { ...data.current, track: { ...track, catalogUrl: "" } } },
  ]) assert.throws(() => parseMusicStatus({ ...data, ...change }))
  assert.deepEqual(parseMusicStatus({ ...data, secret: "ignored", current: { ...data.current, track: { ...track, token: "ignored" } } }), data)
})
test("transport wraps, shuffle picks a different song, and time is safe before metadata loads", () => {
  assert.equal(nextMusicIndex(0, 16, -1, false), 15)
  assert.equal(nextMusicIndex(15, 16, 1, false), 0)
  assert.equal(nextMusicIndex(0, 1, 1, true), 0)
  for (let index = 0; index < 16; index++) {
    for (const random of [0, 0.2, 0.5, 0.99999]) {
      const next = nextMusicIndex(index, 16, 1, true, random)
      assert.notEqual(next, index)
      assert.ok(next >= 0 && next < 16)
    }
  }
  assert.equal(musicTime(30), "0:30")
  assert.equal(musicTime(NaN), "0:00")
  assert.equal(musicTime(-1), "0:00")
})
