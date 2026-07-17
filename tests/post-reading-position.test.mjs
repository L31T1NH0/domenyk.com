import assert from "node:assert/strict"
import test from "node:test"

import {
  getMinimumRestorableOffset,
  isRestorableReadingPosition,
  READING_COMPLETION_THRESHOLD,
} from "../src/lib/post-reading-position.ts"

test("requires meaningful reading depth before restoring a post", () => {
  assert.equal(getMinimumRestorableOffset(600), 320)
  assert.equal(getMinimumRestorableOffset(900), 450)
  assert.equal(getMinimumRestorableOffset(1600), 560)

  assert.equal(isRestorableReadingPosition({ contentOffset: 449, progress: 0.2 }, 900), false)
  assert.equal(isRestorableReadingPosition({ contentOffset: 450, progress: 0.2 }, 900), true)
})

test("does not restore a completed post", () => {
  assert.equal(
    isRestorableReadingPosition({ contentOffset: 800, progress: READING_COMPLETION_THRESHOLD }, 900),
    false
  )
})
