import assert from "node:assert/strict"
import test from "node:test"

import {
  MIN_COMMENT_ACCOUNT_AGE_MS,
  commentAccountPolicy,
} from "../src/lib/comment-policy.ts"

const now = Date.UTC(2026, 6, 17, 12)

test("comments require a verified email for regular users", () => {
  assert.deepEqual(commentAccountPolicy({
    admin: false,
    emailVerified: false,
    createdAt: new Date(now - 24 * 60 * 60_000),
  }, now), { allowed: false, reason: "email_unverified" })
})

test("comments require a minimum account age", () => {
  assert.deepEqual(commentAccountPolicy({
    admin: false,
    emailVerified: true,
    createdAt: new Date(now - MIN_COMMENT_ACCOUNT_AGE_MS + 1),
  }, now), { allowed: false, reason: "account_too_new" })
})

test("admin bypasses account restrictions and established users are classified", () => {
  assert.deepEqual(commentAccountPolicy({
    admin: true,
    emailVerified: false,
    createdAt: new Date(now),
  }, now), { allowed: true, newAccount: false })

  assert.deepEqual(commentAccountPolicy({
    admin: false,
    emailVerified: true,
    createdAt: new Date(now - 25 * 60 * 60_000),
  }, now), { allowed: true, newAccount: false })
})
