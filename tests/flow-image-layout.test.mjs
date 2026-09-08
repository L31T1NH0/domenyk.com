import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdownSync } from '../src/lib/mdx.ts'
import { imageDefaults, safeImageStyle, imageShape } from '../src/lib/content-images.js'
import { compilePublicationCss } from '../src/lib/publication-css.js'

test('native figure defaults support numeric px and percent dimensions with a validated shape source', () => {
  assert.match(imageDefaults('/images/person.webp', 260, 'px', 24), /--image-width:260px;--image-gap:24px;--image-shape:url/)
  assert.match(imageDefaults('/images/person.webp', 37.5, '%', 0), /--image-width:37.5%;--image-gap:0px/)
  for (const source of ['javascript:alert(1)', 'data:image/svg+xml,evil', 'https://x.test/a\n.png']) assert.equal(imageShape(source), 'none')
  assert.doesNotMatch(imageShape('https://x.test/a";color:red;{}.png'), /[;{}]/)
})

test('figures retain classes, formatting, captions and order without overwriting authored CSS', () => {
  const source = '<div data-editor-document="html"><p>Antes</p><figure class="portrait" data-flow-image="left" data-image-width="280" data-image-unit="px" data-image-gap="24" style="width: 35%; margin-right: 20px; shape-outside: inset(0)"><img class="cutout" src="https://example.com/photo.webp" style="object-fit: contain; height: auto"><figcaption class="credit" style="text-align: right">Uma legenda longa</figcaption></figure><p>Depois</p><figure data-flow-image="right"><img src="/images/other.png"></figure></div>'
  const html = renderMarkdownSync(source)
  assert.equal((html.match(/data-flow-image=/g) ?? []).length, 2)
  assert.ok(html.indexOf('Antes') < html.indexOf('<figure'))
  assert.ok(html.indexOf('Depois') < html.lastIndexOf('<figure'))
  assert.match(html, /class="portrait"/)
  assert.match(html, /--image-width:280px;--image-gap:24px/)
  assert.match(html, /width: 35%; margin-right: 20px; shape-outside: inset\(0\)/)
  assert.match(html, /class="cutout"/)
  assert.match(html, /class="credit" style="text-align: right"/)
  assert.match(compilePublicationCss('.portrait { width: 30%; shape-outside: margin-box; }', '[data-publication-surface="a"]'), /\.portrait \{ width: 30%/)
})

test('image formatting rejects unsafe declarations and retains the image policy', () => {
  assert.equal(safeImageStyle('width: 200px; position: fixed; margin-left: -999px; shape-outside: url(https://evil.test); object-fit: contain'), 'width: 200px; object-fit: contain')
  const html = renderMarkdownSync('<div data-editor-document="html"><figure data-flow-image="left"><img src="https://external.test/a.png"></figure></div>', { imagePolicy: { mode: 'none' } })
  assert.doesNotMatch(html, /external\.test|--image-shape|<img/)
})
