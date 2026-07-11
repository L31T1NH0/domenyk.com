import assert from "node:assert/strict"
import test from "node:test"

import {
  asHttpsUrl,
  asSlug,
  asTrustedImageUrl,
  asTrustedImageUrlArray,
} from "../src/lib/validation.ts"

test("accepts strict slugs and rejects path-like values", () => {
  assert.equal(asSlug("post-seguro"), "post-seguro")
  assert.equal(asSlug("../admin"), undefined)
  assert.equal(asSlug("Post Com Espaço"), undefined)
})

test("requires HTTPS where secure media is expected", () => {
  assert.equal(asHttpsUrl("https://media.example/audio.mp3"), "https://media.example/audio.mp3")
  assert.equal(asHttpsUrl("http://media.example/audio.mp3"), undefined)
  assert.equal(asHttpsUrl("javascript:alert(1)"), undefined)
})

test("allows only configured remote image origins", () => {
  const blob = "https://store.public.blob.vercel-storage.com/posts/cover.webp"
  assert.equal(asTrustedImageUrl(blob), blob)
  assert.equal(asTrustedImageUrl("https://img.clerk.com/user.jpg"), "https://img.clerk.com/user.jpg")
  assert.equal(asTrustedImageUrl("https://store.public.blob.vercel-storage.com.evil.test/x.webp"), undefined)
  assert.equal(asTrustedImageUrl("https://tracker.example/pixel.gif"), undefined)
  assert.deepEqual(
    asTrustedImageUrlArray([blob, "https://tracker.example/pixel.gif"], 6),
    [blob]
  )
})
