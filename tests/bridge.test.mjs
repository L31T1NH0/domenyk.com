import assert from "node:assert/strict"
import test from "node:test"
import { currentBridge, currentBridgePresence, parseBridgeStatus } from "../src/lib/bridge.ts"

const now = Date.now()
const match = { red: { name: "Domenyk", score: 3 }, blue: { name: "Adversario", score: 2 }, elapsedSeconds: 139 }
const current = { match, updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 20_000).toISOString() }

test("bridge projects only public metadata, advances time and expires without another fetch", () => {
  assert.deepEqual(parseBridgeStatus({ secret: "hidden", current: { ...current, sessionId: "hidden", match: { ...match, matchId: "hidden" } } }), { current })
  assert.equal(currentBridge({ current }, now + 3999).elapsedSeconds, 142)
  assert.equal(currentBridge({ current }, now + 20_000), null)
  assert.equal(currentBridge({ current }, now - 11_000), null)
  assert.equal(currentBridge({ current: null }, now), null)
  assert.equal(currentBridge({ current: { ...current, match: { ...match, elapsedSeconds: 899 } } }, now + 19_999).elapsedSeconds, 900)
})

test("bridge rejects invalid players, scores, elapsed time and expiry", () => {
  for (const value of [null, {}, { current: {} }, { current: { ...current, expiresAt: "bad" } }, { current: { ...current, expiresAt: new Date(now + 90_000).toISOString() } },
    ...[{ red: { name: "<script>", score: 0 } }, { blue: { name: "domenyk", score: 1 } }, { blue: { name: "Other", score: 6 } }, { blue: { name: "Other", score: 2, disconnected: "true" } }, { red: { name: "Domenyk", score: -1 } }, { elapsedSeconds: 901 }, { elapsedSeconds: 1.5 }].map(change => ({ current: { ...current, match: { ...match, ...change } } }))]) {
    assert.throws(() => parseBridgeStatus(value))
  }
})

test("bridge keeps both names and scores when a player disconnects and supports older clients", () => {
  const departed = { ...match, blue: { ...match.blue, disconnected: true } }
  const status = parseBridgeStatus({ current: { ...current, match: departed } })
  assert.deepEqual(currentBridge(status, now), departed)
  const rejoined = parseBridgeStatus({ current: { ...current, match: { ...match, blue: { ...match.blue, disconnected: false } } } })
  assert.deepEqual(currentBridge(rejoined, now), match)
})

test("Minecraft menu and Bridge queue are visible without match data and expire normally", () => {
  for (const activity of ["minecraft", "waiting"]) {
    const data = parseBridgeStatus({ current: { ...current, activity, match: null } })
    assert.equal(currentBridgePresence(data, now).activity, activity)
    assert.equal(currentBridge(data, now), null)
    assert.equal(currentBridgePresence(data, now + 20_000), null)
    assert.throws(() => parseBridgeStatus({ current: { ...current, activity } }))
  }
  assert.throws(() => parseBridgeStatus({ current: { ...current, activity: "playing", match: null } }))
  assert.throws(() => parseBridgeStatus({ current: { ...current, activity: "offline", match: null } }))
})
