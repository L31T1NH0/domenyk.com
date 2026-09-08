import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"

/** @typedef {import('hast').Element} Element
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').RootContent} RootContent
 * @typedef {import('hast').Text} Text
 * @typedef {{ node: Text | Element, start: number, end: number }} Segment
 * @typedef {{ start: number, end: number, element: Element }} Formula
 */

const mathParser = unified().use(remarkParse).use(remarkMath)
const literalElements = new Set(["code", "pre", "kbd", "samp", "script", "style", "textarea", "math", "svg"])
const inlineElements = new Set(["a", "abbr", "b", "cite", "del", "em", "i", "ins", "mark", "q", "s", "small", "span", "strong", "sub", "sup", "time", "u"])

/** Recognize LaTeX in HTML text while preserving authored markup and styles. */
export default function rehypeHtmlMath() {
  /** @param {Root} tree */
  return (tree) => {
    /** @type {Map<RootContent, RootContent[]>} */
    const replacements = new Map()

    /** @param {Root | Element} parent */
    function process(parent) {
      let source = ""
      /** @type {Segment[]} */
      let segments = []

      function flush() {
        if (source.includes("$")) {
          /** @type {Formula[]} */
          const formulas = []
          visit(mathParser.parse(source), (node) => {
            if (node.type !== "math" && node.type !== "inlineMath") return
            const math = /** @type {import('mdast-util-math').Math | import('mdast-util-math').InlineMath} */ (node)
            const start = math.position?.start.offset
            const end = math.position?.end.offset
            if (start === undefined || end === undefined) return
            formulas.push({
              start, end,
              element: {
                type: "element", tagName: "code",
                properties: { className: [math.type === "math" ? "math-display" : "math-inline"] },
                children: [{ type: "text", value: math.value }],
              },
            })
          })

          let formulaIndex = 0
          for (const segment of segments) {
            while (formulas[formulaIndex]?.end <= segment.start) formulaIndex++
            /** @type {RootContent[]} */
            const children = []
            let cursor = segment.start
            let changed = false
            for (let i = formulaIndex; i < formulas.length && formulas[i].start < segment.end; i++) {
              const formula = formulas[i]
              if (formula.start > cursor && segment.node.type === "text") {
                children.push({ type: "text", value: source.slice(cursor, formula.start) })
              }
              if (formula.start >= segment.start) children.push(formula.element)
              cursor = Math.min(segment.end, formula.end)
              changed = true
            }
            if (!changed) continue
            if (cursor < segment.end) children.push({ type: "text", value: source.slice(cursor, segment.end) })
            replacements.set(segment.node, children)
          }
        }
        source = ""
        segments = []
      }

      /** @param {RootContent} node */
      function collect(node) {
        if (node.type === "text" || (node.type === "element" && node.tagName === "br")) {
          const value = node.type === "text" ? node.value : "\n"
          segments.push({ node, start: source.length, end: source.length + value.length })
          source += value
        } else if (node.type === "element") {
          if (literalElements.has(node.tagName)) {
            flush()
          } else if (inlineElements.has(node.tagName)) {
            node.children.forEach(collect)
          } else {
            flush()
            process(node)
          }
        }
      }

      parent.children.forEach(collect)
      flush()
    }

    /** @param {Root | Element} parent */
    function replace(parent) {
      parent.children = parent.children.flatMap(node => {
        const replacement = replacements.get(node)
        if (replacement) return replacement
        if (node.type === "element") replace(node)
        return [node]
      })
    }

    // A formula may span several styled spans or soft line breaks, but never
    // separate paragraphs, code examples, or non-text content such as images.
    process(tree)
    replace(tree)
  }
}
