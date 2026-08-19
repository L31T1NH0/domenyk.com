import assert from "node:assert/strict"
import test from "node:test"

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown"
import { CodeHighlightNode, CodeNode } from "@lexical/code"
import { LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { createEditor } from "lexical"
import {
  prepareLatexForLexicalImport,
  restoreLatexAfterLexicalExport,
} from "../src/components/editor/latex-markdown.ts"
import { renderMarkdownSync } from "../src/lib/mdx.ts"
import { asString } from "../src/lib/validation.ts"

const COMPLETE_LATEX_MARKDOWN = String.raw`# Teste de LaTeX

Fórmula inline:

$P \rightarrow Q$

Negação:

$\neg Q$

Conjunção:

$P \land Q$

Disjunção:

$P \lor Q$

Não implicação:

$P \not\Rightarrow Q$

Quantificador universal:

$\forall x \in A$

Quantificador existencial:

$\exists x \in A$

Pertencimento:

$x \in A$

Não pertencimento:

$x \notin A$

Delta:

$\Delta R = 0$

Letra grega:

$\pi = R - C$

Fração:

$\frac{a}{b}$

Potência:

$x^2$

Subscrito:

$x_1$

Expressão em bloco:

$$
\Delta R = 0 \land \Delta C > 0
\Rightarrow
\Delta \pi < 0
$$

Lógica:

$$
P \rightarrow Q
$$

$$
\neg Q
$$

$$
\therefore \neg P
$$

Quantificação:

$$
\forall x \in A,\; P(x) \rightarrow Q(x)
$$`

function lexicalRoundTrip(markdown) {
  const editor = createEditor({
    namespace: "latex-markdown-round-trip",
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode],
    onError: (error) => { throw error },
  })
  let exported = ""

  editor.update(() => {
    $convertFromMarkdownString(prepareLatexForLexicalImport(markdown), TRANSFORMERS)
    exported = restoreLatexAfterLexicalExport(
      $convertToMarkdownString(TRANSFORMERS)
    )
  }, { discrete: true })

  return exported
}

test("preserves generic LaTeX commands through the Lexical round trip", () => {
  const markdown = lexicalRoundTrip(COMPLETE_LATEX_MARKDOWN)

  for (const command of [
    String.raw`\rightarrow`,
    String.raw`\Rightarrow`,
    String.raw`\neg`,
    String.raw`\land`,
    String.raw`\lor`,
    String.raw`\therefore`,
    String.raw`\forall`,
    String.raw`\exists`,
    String.raw`\in`,
    String.raw`\notin`,
    String.raw`\Delta`,
    String.raw`\pi`,
    String.raw`\frac`,
  ]) {
    assert.ok(markdown.includes(command), `missing ${command}`)
    assert.ok(!markdown.includes(`\\${command}`), `duplicated ${command}`)
  }

  const html = renderMarkdownSync(markdown)
  for (const symbol of ["→", "⇒", "¬", "∧", "∨", "∴", "∀", "∃", "∈", "∉", "Δ", "π"]) {
    assert.ok(html.includes(symbol), `missing rendered symbol ${symbol}`)
  }
  assert.match(html, /<mfrac>/)
  assert.match(html, /class="katex-display"/)
})

test("preserves LaTeX through JSON and API validation", () => {
  const input = String.raw`Uma proposição: $P \rightarrow Q$ e $\neg Q$.`
  const afterEditor = lexicalRoundTrip(input)
  const afterJson = JSON.parse(JSON.stringify({ content: afterEditor })).content
  const afterValidation = asString(afterJson, 20_000)

  assert.equal(afterEditor, input)
  assert.equal(afterJson, input)
  assert.equal(afterValidation, input)
})

test("preserves intentional double backslashes used by LaTeX environments", () => {
  const input = String.raw`$$
\begin{aligned}x&=1\\y&=2\end{aligned}
$$`

  assert.equal(lexicalRoundTrip(input), input)
  assert.match(renderMarkdownSync(lexicalRoundTrip(input)), /class="katex-display"/)
})

test("does not rewrite backslashes outside math or inside code", () => {
  const exported = [
    String.raw`Texto \\ fora de matemática.`,
    String.raw`Código: \`$P \\rightarrow Q$\`.`,
    "```text",
    String.raw`$P \\rightarrow Q$`,
    "```",
    String.raw`Fórmula: $P \\rightarrow Q$.`,
  ].join("\n")

  const restored = restoreLatexAfterLexicalExport(exported)

  assert.ok(restored.includes(String.raw`Texto \\ fora de matemática.`))
  assert.ok(restored.includes(String.raw`\`$P \\rightarrow Q$\``))
  assert.ok(restored.includes(["```text", String.raw`$P \\rightarrow Q$`, "```"].join("\n")))
  assert.ok(restored.includes(String.raw`Fórmula: $P \rightarrow Q$.`))
})
