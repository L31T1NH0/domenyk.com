import assert from "node:assert/strict"
import test from "node:test"

import {
  isPostLocale,
  isTranslationLocale,
  isTranslationRevisionStale,
  postPath,
} from "../src/lib/post-locales.ts"

test("keeps the original URL and gives translations locale-prefixed URLs", () => {
  assert.equal(postPath("texto-original", "pt"), "/posts/texto-original")
  assert.equal(postPath("texto-original", "en"), "/en/posts/texto-original")
  assert.equal(postPath("texto com espaço", "de"), "/de/posts/texto%20com%20espa%C3%A7o")
})

test("accepts only the configured post and translation locales", () => {
  assert.equal(isPostLocale("pt"), true)
  assert.equal(isPostLocale("id"), true)
  assert.equal(isPostLocale("fr"), false)
  assert.equal(isTranslationLocale("de"), true)
  assert.equal(isTranslationLocale("pt"), false)
})

test("marks a translation stale only when the original revision is newer", () => {
  const original = "2026-02-01T00:00:00.000Z"
  assert.equal(isTranslationRevisionStale("2026-01-31T23:59:59.000Z", original), true)
  assert.equal(isTranslationRevisionStale(original, original), false)
  assert.equal(isTranslationRevisionStale("2026-02-02T00:00:00.000Z", original), false)
})
