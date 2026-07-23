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

test("renders a sanitized flow image with server-generated shape styles", () => {
  const html = renderMarkdownSync(
    '<figure data-flow-image="left" data-flow-width="42"><img src="https://images.example/cutout.webp" alt="Pessoa em pé"></figure>'
  )

  assert.match(html, /<figure data-flow-image="left" data-flow-width="42" style="--flow-image-width:42%;--flow-image-shape:url\(&#x22;https:\/\/images\.example\/cutout\.webp&#x22;\)">/)
  assert.match(html, /<img src="https:\/\/images\.example\/cutout\.webp" alt="Pessoa em pé">/)
})

test("moves a legacy terminal flow figure before the text it must affect", () => {
  const html = renderMarkdownSync([
    "Primeiro parágrafo.",
    "Segundo parágrafo.",
    '<figure data-flow-image="left" data-flow-width="32"><img src="https://images.example/cutout.webp" alt="Recorte"></figure>',
  ].join("\n\n"))

  assert.ok(html.indexOf("<figure") < html.indexOf("<p"))
  assert.equal((html.match(/data-flow-image=/g) ?? []).length, 1)
})

test("preserves an explicit adaptive theme marker on a flow image", () => {
  const html = renderMarkdownSync(
    '<figure data-flow-image="right" data-flow-width="32" data-image-theme="adaptive"><img src="https://images.example/line-art.svg" alt="Desenho"></figure>'
  )

  assert.match(html, /data-image-theme="adaptive"/)
  assert.match(html, /data-flow-image="right" data-flow-width="32"/)
})

test("keeps only the first flow figure and degrades later figures to ordinary content", () => {
  const html = renderMarkdownSync([
    '<figure data-flow-image="left" data-flow-width="42"><img src="https://images.example/one.webp" alt="Primeira"></figure>',
    '<figure data-flow-image="right" data-flow-width="52" data-image-theme="adaptive"><img src="https://images.example/two.webp" alt="Segunda"></figure>',
  ].join("\n\n"))

  assert.equal((html.match(/data-flow-image=/g) ?? []).length, 1)
  assert.equal((html.match(/data-image-theme=/g) ?? []).length, 0)
  assert.match(html, /<figure><img src="https:\/\/images\.example\/two\.webp" alt="Segunda"><\/figure>/)
})

test("drops invalid flow metadata and never preserves authored inline styles", () => {
  const html = renderMarkdownSync(
    '<figure data-flow-image="outside" data-flow-width="999" style="position:fixed"><img src="https://images.example/cutout.webp" alt="Recorte"></figure>'
  )

  assert.match(html, /<figure><img src="https:\/\/images\.example\/cutout\.webp" alt="Recorte"><\/figure>/)
  assert.doesNotMatch(html, /data-flow|position:fixed|--flow-image/)
})

test("fills empty image alt text with a contextual fallback without replacing authored text", () => {
  const html = renderMarkdownSync([
    "![](https://images.example/empty.webp)",
    "![Descrição própria](https://images.example/authored.webp)",
    "![](https://images.example/second-empty.webp)",
  ].join("\n\n"), { defaultImageAlt: "Imagem relacionada ao texto" })

  assert.match(html, /alt="Imagem relacionada ao texto"/)
  assert.match(html, /alt="Descrição própria"/)
  assert.match(html, /alt="Imagem relacionada ao texto \(3\)"/)
})

test("marks external links from user content as untrusted", () => {
  const html = renderMarkdownSync("[site externo](https://example.com/path)", {
    externalLinkRel: ["ugc", "nofollow", "noopener", "noreferrer"],
  })

  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="ugc nofollow noopener noreferrer"/)
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
