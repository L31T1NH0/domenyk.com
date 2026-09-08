import assert from "node:assert/strict"
import test from "node:test"
import { renderMarkdownSync } from "../src/lib/mdx.ts"
import { normalizeEditorialText, editorialTextStyle } from "../src/lib/editorial-text.js"

test("editorial text renders formatted content with validated responsive styles", () => {
  const html = renderMarkdownSync(':::editor center 24 1.8 16 sand\n\n**Texto** com [link](https://example.com).\n\n:::')
  assert.match(html, /data-editor-align="center"/)
  assert.match(html, /font-size: min\(24px, 8vw\)/)
  assert.match(html, /line-height: 1.8/)
  assert.match(html, /<strong>Texto<\/strong>/)
  assert.doesNotMatch(html, /:::editor/)
})

test("editorial directives stay literal in code and incomplete wrappers", () => {
  assert.match(renderMarkdownSync('```\n:::editor center 24 1.8 16 sand\n\ntexto\n\n:::\n```'), /:::editor/)
  assert.match(renderMarkdownSync(':::editor center 24 1.8 16 sand\n\ntexto'), /:::editor/)
})

test("editorial formatting never permits arbitrary styles or unsafe HTML", () => {
  assert.equal(normalizeEditorialText({size:'999',tone:'evil',align:'fixed'}).size, 'auto')
  assert.doesNotMatch(editorialTextStyle({tone:'url(evil)'}), /url/)
  const html = renderMarkdownSync(':::editor center 24 1.8 16 sand\n\n<img src="https://example.com/p.png" onerror="alert(1)"><script>alert(1)</script>\n\n:::')
  assert.doesNotMatch(html, /onerror|<script/)
})

test("positioned images retain width, alignment, safe caption and theme", () => {
  const html = renderMarkdownSync('<figure data-editor-image="right" data-editor-width="60" data-image-theme="adaptive"><img src="https://example.com/p.png" alt="Foto"><figcaption>Uma legenda</figcaption></figure>')
  assert.match(html, /--image-width:60%/)
  assert.match(html, /data-image-theme="adaptive"/)
  assert.match(html, /<figcaption>Uma legenda<\/figcaption>/)
  const invalid = renderMarkdownSync('<figure data-editor-image="right" data-editor-width="999" style="position:fixed"><img src="https://example.com/p.png"></figure>')
  assert.doesNotMatch(invalid, /--image-width:999|position:fixed/)
})

test("HTML documents preserve literal text and sanitized inline formatting", () => {
  const html = renderMarkdownSync('<div data-editor-document="html"><p style="text-align: right; line-height: 1.8; position: fixed">Texto **literal** <span style="font-size: 24px; color: #ff0000; background-image: url(javascript:alert(1))">palavra</span></p><script>alert(1)</script></div>')
  assert.match(html, /Texto \*\*literal\*\*/)
  assert.match(html, /text-align: right/)
  assert.match(html, /font-size: 24px/)
  assert.match(html, /color: #ff0000/)
  assert.doesNotMatch(html, /<script|position:|background-image|data-editor-safe-style|data-editor-document/)
})

test("HTML paragraphs, images and blank lines retain structure", () => {
  const html = renderMarkdownSync('<div data-editor-document="html"><p>Primeiro</p><p><br></p><figure data-editor-image="right" data-editor-width="60"><img src="https://example.com/a.png" alt="Foto"><figcaption>Legenda</figcaption></figure><p>Segundo</p></div>')
  assert.match(html, /<p[^>]*>Primeiro<\/p><p[^>]*><br><\/p>/)
  assert.match(html, /--image-width:60%/)
  assert.match(html, /<figcaption>Legenda<\/figcaption>/)
  assert.doesNotMatch(html, /:::editor/)
})
