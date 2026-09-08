import assert from "node:assert/strict"
import test from "node:test"
import { personalUpdateContent } from "../src/lib/personal-timeline.ts"

test("mural rejects missing, malformed, blank and oversized content", () => {
  for (const value of [null, [], "text", {}, { content: 12 }, { content: " \n " }, { content: "a".repeat(20_001) }]) {
    assert.equal(personalUpdateContent(value), null)
  }
})

test("mural accepts image-only markdown and preserves formatting", () => {
  const image = "![Descrição](https://example.com/photo.jpg)"
  assert.equal(personalUpdateContent({ content: image }), image)
  assert.equal(personalUpdateContent({ content: "  **texto**\n\n- item\n  " }), "**texto**\n\n- item")
  assert.equal(personalUpdateContent({ content: "a".repeat(20_000) }).length, 20_000)
})
