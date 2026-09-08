import assert from "node:assert/strict"
import test from "node:test"
import { extractParagraphIds, renderMarkdown, renderMarkdownSync } from "../src/lib/mdx.ts"

const document = (body, raw = false) => `<div data-editor-document="html"${raw ? ' data-editor-source="raw"' : ''}>${body}</div>`
const formulaCount = html => (html.match(/class="katex"/g) ?? []).length

test("renders the meritocracy essay's notation in Markdown and both HTML editor modes", async () => {
  const paragraphs = [
    String.raw`Se chamarmos tentativa de $T$ e ganho de $G$, essa versão forte pode ser resumida como $T \rightarrow G$: havendo tentativa, haverá ganho.`,
    String.raw`Por isso, $G \not\Rightarrow M$: ganho não implica mérito.`,
    String.raw`Mas também $M \not\Rightarrow G$: mérito não implica necessariamente ganho.`,
  ]
  const markdown = paragraphs.join("\n\n")
  const body = paragraphs.map(text => `<p><span style="white-space: pre-wrap">${text}</span></p>`).join("")
  for (const content of [markdown, document(body), document(body, true)]) {
    const html = renderMarkdownSync(content)
    assert.equal(formulaCount(html), 5)
    assert.doesNotMatch(html, /katex-error/)
    assert.match(html, /→/)
    assert.ok(html.includes(String.raw`<annotation encoding="application/x-tex">G \not\Rightarrow M</annotation>`))
    assert.equal(await renderMarkdown(content), html)
  }
})

test("renders display math across styled spans and editor line breaks without losing surrounding formatting", () => {
  const content = document(String.raw`<p style="text-align: center"><strong>Probabilidade **literal**:</strong><br><span>$$</span><br><span>P(G\mid T)&gt;P(G\mid\neg T)</span><br><span>$$</span><br><em>Depois.</em></p>`)
  const html = renderMarkdownSync(content)
  assert.equal(formulaCount(html), 1)
  assert.match(html, /class="katex-display"/)
  assert.doesNotMatch(html, /katex-error/)
  assert.match(html, /text-align: center/)
  assert.match(html, /<strong>Probabilidade \*\*literal\*\*:<\/strong>/)
  assert.match(html, /<em>Depois\.<\/em>/)
  assert.equal((html.match(/<br>/g) ?? []).length, 2)
})

test("formulas split by inline formatting keep the complete LaTeX and neighboring text", () => {
  const html = renderMarkdownSync(document(String.raw`<p>Antes $P <strong>\rightarrow</strong> Q$ entre $x<span>_1</span>$ depois.</p>`))
  assert.equal(formulaCount(html), 2)
  assert.ok(html.includes(String.raw`<annotation encoding="application/x-tex">P \rightarrow Q</annotation>`))
  assert.ok(html.includes('<annotation encoding="application/x-tex">x_1</annotation>'))
  assert.match(html, /Antes /)
  assert.match(html, / entre /)
  assert.match(html, / depois\./)
})

test("leaves code, escaped delimiters, attributes and incomplete formulas literal", () => {
  const content = document(String.raw`<pre><span>$P \rightarrow Q$</span></pre><p><code>$x$</code> <kbd><span>$y$</span></kbd> \$T\$ e $incompleta</p><p title="$atributo$">R$ 20.</p>`)
  const html = renderMarkdownSync(content)
  assert.equal(formulaCount(html), 0)
  assert.match(html, /\$P \\rightarrow Q\$/)
  assert.match(html, /\$incompleta/)
  assert.match(html, /title="\$atributo\$"/)
})

test("does not join math across paragraphs, code or images", () => {
  const html = renderMarkdownSync(document('<p>$T</p><p>G$</p><p>$M<code>literal</code>G$</p><p>$x<img src="/test.png" alt="Foto">y$</p>'))
  assert.equal(formulaCount(html), 0)
  assert.match(html, /<img /)
})

test("HTML math retains sanitization and does not change existing paragraph identifiers", () => {
  const content = document(String.raw`<p style="text-align: right; position: fixed">$\htmlClass{evil}{x}$ <img src="/test.png" onerror="alert(1)"></p><script>alert(1)</script>`)
  const html = renderMarkdownSync(content)
  assert.equal(formulaCount(html), 1)
  assert.doesNotMatch(html, /class="evil"|onerror|<script|position: fixed/)
  assert.match(html, /text-align: right/)
  assert.equal(extractParagraphIds(document('<p>$T$</p>'))[0], "2554b649")
})

test("an undelimited pasted equation remains literal instead of guessing or removing duplicate content", () => {
  const equation = String.raw`P(G∣T)>P(G∣¬T)P(G\mid T)>P(G\mid\neg T)`
  const html = renderMarkdownSync(document(`<p>${equation}</p>`))
  assert.equal(formulaCount(html), 0)
  assert.ok(html.includes(equation))
})
