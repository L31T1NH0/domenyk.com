import assert from "node:assert/strict"
import test from "node:test"

import {
  dailyNotificationAggregateKey,
  notificationDay,
} from "../src/lib/notification-aggregation.ts"

test("groups notification occurrences by calendar day in Fortaleza", () => {
  const beforeMidnight = new Date("2026-07-21T02:59:59.999Z")
  const afterMidnight = new Date("2026-07-21T03:00:00.000Z")

  assert.equal(notificationDay(beforeMidnight), "2026-07-20")
  assert.equal(notificationDay(afterMidnight), "2026-07-21")
  assert.equal(
    dailyNotificationAggregateKey("view:post-id", beforeMidnight),
    "view:post-id:day:2026-07-20"
  )
  assert.equal(
    dailyNotificationAggregateKey("view:post-id", afterMidnight),
    "view:post-id:day:2026-07-21"
  )
})

test("keeps occurrences for the same content and day under one key", () => {
  const morning = new Date("2026-07-20T10:00:00.000Z")
  const evening = new Date("2026-07-21T01:30:00.000Z")

  assert.equal(
    dailyNotificationAggregateKey("note-view:note-id", morning),
    dailyNotificationAggregateKey("note-view:note-id", evening)
  )
})
