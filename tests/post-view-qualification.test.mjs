import assert from "node:assert/strict"
import test from "node:test"

import {
  POST_VIEW_MIN_ACTIVE_SECONDS,
  POST_VIEW_MIN_PROGRESS,
  qualifiesPostView,
} from "../src/lib/post-view-qualification.ts"

test("a post view requires ten active seconds and one percent of progress", () => {
  assert.equal(qualifiesPostView({
    activeSeconds: POST_VIEW_MIN_ACTIVE_SECONDS,
    progress: POST_VIEW_MIN_PROGRESS,
    interacted: false,
  }), true)

  assert.equal(qualifiesPostView({
    activeSeconds: POST_VIEW_MIN_ACTIVE_SECONDS - 1,
    progress: POST_VIEW_MIN_PROGRESS,
    interacted: false,
  }), false)

  assert.equal(qualifiesPostView({
    activeSeconds: POST_VIEW_MIN_ACTIVE_SECONDS,
    progress: POST_VIEW_MIN_PROGRESS - 0.001,
    interacted: false,
  }), false)
})

test("interaction can replace progress but not active time", () => {
  assert.equal(qualifiesPostView({
    activeSeconds: POST_VIEW_MIN_ACTIVE_SECONDS,
    progress: 0,
    interacted: true,
  }), true)

  assert.equal(qualifiesPostView({
    activeSeconds: POST_VIEW_MIN_ACTIVE_SECONDS - 1,
    progress: 0,
    interacted: true,
  }), false)
})

test("invalid progress values never qualify", () => {
  assert.equal(qualifiesPostView({ activeSeconds: 10, progress: Number.NaN, interacted: true }), false)
  assert.equal(qualifiesPostView({ activeSeconds: 10, progress: 1.01, interacted: true }), false)
})
