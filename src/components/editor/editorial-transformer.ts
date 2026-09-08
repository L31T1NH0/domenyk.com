import { $convertFromMarkdownString, type MultilineElementTransformer, type Transformer } from "@lexical/markdown"
import { $createParagraphNode, $isElementNode, $isParagraphNode, type ElementFormatType } from "lexical"
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text"
import { editorialTextFromStyle, editorialTextStyle, normalizeEditorialText } from "@/lib/editorial-text"

export function createEditorialTextTransformer(base: Transformer[]): MultilineElementTransformer {
  return {
    type: "multiline-element",
    dependencies: [],
    regExpStart: /^:::editor (left|center|right|justify) ([\w.]+) ([\w.]+) ([\w.]+) (\w+)$/,
    regExpEnd: /^:::$/,
    export(node, children) {
      if (!$isParagraphNode(node) && !$isHeadingNode(node) && !$isQuoteNode(node)) return null
      // Lexical separates empty paragraphs with a single newline. Wrapping
      // them would join adjacent closing/opening directives into plain text.
      if (!node.getTextContent().trim()) return null
      // Image paragraphs use the image transformers, not text wrappers.
      if (node.getChildren().some(child => child.getType() === "image")) return null
      const p = editorialTextFromStyle(node.getStyle(), node.getFormatType())
      if (p.align === "left" && p.size === "auto" && p.leading === "auto" && p.spacing === "auto" && p.tone === "none") return null
      let content = children(node)
      if ($isHeadingNode(node)) content = `${"#".repeat(Number(node.getTag().slice(1)))} ${content}`
      if ($isQuoteNode(node)) content = content.split("\n").map(line => `> ${line}`).join("\n")
      return `:::editor ${p.align} ${p.size} ${p.leading} ${p.spacing} ${p.tone}\n\n${content}\n\n:::`
    },
    replace(root, _children, match, _end, lines) {
      if (!lines) return false
      const [, align, size, leading, spacing, tone] = match
      const p = normalizeEditorialText({ align, size, leading, spacing, tone })
      const temporary = $createParagraphNode()
      $convertFromMarkdownString(lines.join("\n"), base, temporary)
      for (const child of temporary.getChildren()) {
        if ($isElementNode(child)) {
          child.setFormat(p.align as ElementFormatType)
          child.setStyle(editorialTextStyle(p))
        }
        root.append(child)
      }
    },
  }
}
