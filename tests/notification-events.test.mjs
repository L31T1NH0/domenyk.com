import assert from "node:assert/strict"
import test from "node:test"

import {
  ADMIN_PUSH_TOPICS,
  normalizeAdminPushTopics,
} from "../src/lib/notification-events.ts"

test("keeps only valid, unique admin notification topics", () => {
  assert.deepEqual(
    normalizeAdminPushTopics(["accounts", "accounts", "post_comments", "unknown", null]),
    ["accounts", "post_comments"]
  )
})

test("maps legacy all-or-nothing admin subscriptions to every topic", () => {
  assert.deepEqual(normalizeAdminPushTopics(undefined, true), [...ADMIN_PUSH_TOPICS])
  assert.deepEqual(normalizeAdminPushTopics(undefined, false), [])
})

test("an explicit empty topic list stays empty even for a legacy enabled flag", () => {
  assert.deepEqual(normalizeAdminPushTopics([], true), [])
})
