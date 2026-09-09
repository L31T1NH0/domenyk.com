import assert from "node:assert/strict"
import test from "node:test"
import { MAX_RICH_CONTENT_LENGTH } from "../src/lib/content-format.js"
import { personalUpdateContent, personalUpdateOrderDirection } from "../src/lib/personal-timeline.ts"

test("mural rejects missing, malformed, blank and oversized content", () => {
  for (const value of [null, [], "text", {}, { content: 12 }, { content: " \n " }, { content: "a".repeat(MAX_RICH_CONTENT_LENGTH + 1) }]) {
    assert.equal(personalUpdateContent(value), null)
  }
})

test("mural accepts image-only markdown and preserves formatting", () => {
  const image = "![Descrição](https://example.com/photo.jpg)"
  assert.equal(personalUpdateContent({ content: image }), image)
  assert.equal(personalUpdateContent({ content: "  **texto**\n\n- item\n  " }), "**texto**\n\n- item")
  assert.equal(personalUpdateContent({ content: "a".repeat(MAX_RICH_CONTENT_LENGTH) }).length, MAX_RICH_CONTENT_LENGTH)
})

test("mural accepts only explicit ordering directions", () => {
  assert.equal(personalUpdateOrderDirection({ direction: "up" }), "up")
  assert.equal(personalUpdateOrderDirection({ direction: "down" }), "down")
  for (const value of [null, {}, { direction: "left" }, { direction: 1 }]) {
    assert.equal(personalUpdateOrderDirection(value), null)
  }
})
