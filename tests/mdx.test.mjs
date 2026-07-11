import assert from "node:assert/strict"
import test from "node:test"

import {
  extractParagraphIds,
  hasParagraphId,
  renderMarkdownSync,
} from "../src/lib/mdx.ts"

test("sanitizes after heading transforms and keeps safe fragment links", () => {
  const html = renderMarkdownSync('# location\n\n[Ir](#location)\n\n<img src="x" onerror="alert(1)"><script>alert(1)</script>')

  assert.match(html, /<h2 id="user-content-location"><a href="#user-content-location">location<\/a><\/h2>/)
  assert.match(html, /<a href="#user-content-location">Ir<\/a>/)
  assert.doesNotMatch(html, /onerror|<script/i)
})

test("preserves the author reference data attributes through sanitization", () => {
  const html = renderMarkdownSync("@autor e @co-autor", {
    coAuthorImageUrl: "https://images.example/co-author.webp",
  })

  assert.match(html, /data-role="author-reference" data-kind="author"/)
  assert.match(html, /data-role="author-reference" data-kind="co-author"/)
})

test("restricted image policy requires an exact origin and path and enforces the limit", () => {
  const options = {
    imagePolicy: {
      mode: "allowlist",
      allowedUrlPrefixes: ["https://store.public.blob.vercel-storage.com/comments/"],
      maxImages: 2,
    },
  }
  const markdown = [
    "![one](https://store.public.blob.vercel-storage.com/comments/one.webp)",
    "![wrong host](https://store.public.blob.vercel-storage.com.evil.test/comments/pixel.webp)",
    "![wrong path](https://store.public.blob.vercel-storage.com/notes/pixel.webp)",
    "![same origin](/api/posts/post-id?view=1)",
    "![two](https://store.public.blob.vercel-storage.com/comments/two.webp)",
    "![over limit](https://store.public.blob.vercel-storage.com/comments/three.webp)",
    '<picture><source srcset="https://tracker.example/pixel.webp"></picture>',
  ].join("\n\n")

  const html = renderMarkdownSync(markdown, options)

  assert.equal((html.match(/<img /g) ?? []).length, 2)
  assert.match(html, /comments\/one\.webp/)
  assert.match(html, /comments\/two\.webp/)
  assert.doesNotMatch(html, /evil\.test|\/notes\/pixel|\/api\/posts|three\.webp|tracker\.example|<source/i)
})

test("omitting imagePolicy preserves trusted post and note image behavior", () => {
  const html = renderMarkdownSync("![external](https://images.example/post.webp)")

  assert.match(html, /<img src="https:\/\/images\.example\/post\.webp"/)
})

test("paragraph IDs preserve the first legacy ID and disambiguate duplicates and collisions", () => {
  const sharedPrefix = "x".repeat(80)
  const markdown = [
    "Mesmo texto.",
    "Mesmo texto.",
    "Mesmo texto.",
    `${sharedPrefix}A`,
    `${sharedPrefix}B`,
  ].join("\n\n")
  const ids = extractParagraphIds(markdown)

  assert.equal(ids.length, 5)
  assert.equal(ids[0], "4ccd427f")
  assert.equal(new Set(ids).size, ids.length)
  assert.match(ids[1], /^4ccd427f-[a-f0-9]{16}$/)
  assert.equal(ids[2], `${ids[1]}-2`)
  assert.match(ids[4], new RegExp(`^${ids[3]}-[a-f0-9]{16}$`))
  assert.equal(hasParagraphId(markdown, ids[4]), true)
  assert.equal(hasParagraphId(markdown, "nao-existe"), false)
})
