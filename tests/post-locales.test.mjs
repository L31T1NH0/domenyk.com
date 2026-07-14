import assert from "node:assert/strict"
import test from "node:test"

import {
  isPostLocale,
  isTranslationLocale,
  isTranslationRevisionStale,
  localizedPostPath,
  postPath,
  slugifyPostTitle,
} from "../src/lib/post-locales.ts"

test("keeps the original URL and gives translations locale-prefixed URLs", () => {
  assert.equal(postPath("texto-original", "pt"), "/posts/texto-original")
  assert.equal(postPath("texto-original", "en"), "/en/posts/texto-original")
  assert.equal(postPath("texto com espaço", "de"), "/de/posts/texto%20com%20espa%C3%A7o")
})

test("uses each translated title in that locale's post URL", () => {
  const post = {
    slug: "mercado-negro-nao-e-errado",
    translations: {
      id: { title: "Pasar Gelap Bukanlah Masalahnya" },
      de: { title: "Der Schwarzmarkt ist nicht das Problem", slug: "eigener-deutscher-slug" },
    },
  }

  assert.equal(slugifyPostTitle("Pasar Gelap Bukanlah Masalahnya"), "pasar-gelap-bukanlah-masalahnya")
  assert.equal(localizedPostPath(post, "pt"), "/posts/mercado-negro-nao-e-errado")
  assert.equal(localizedPostPath(post, "id"), "/id/posts/pasar-gelap-bukanlah-masalahnya")
  assert.equal(localizedPostPath(post, "de"), "/de/posts/eigener-deutscher-slug")
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
