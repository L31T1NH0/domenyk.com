function isEscaped(value: string, index: number): boolean {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

function closingMathDelimiter(
  markdown: string,
  start: number,
  delimiterLength: 1 | 2
): number {
  for (let index = start; index < markdown.length; index += 1) {
    if (delimiterLength === 1 && markdown[index] === "\n") return -1
    if (markdown[index] !== "$" || isEscaped(markdown, index)) continue

    let dollars = 1
    while (markdown[index + dollars] === "$") dollars += 1
    if (
      (delimiterLength === 1 && dollars === 1) ||
      (delimiterLength === 2 && dollars >= 2)
    ) {
      return index
    }
    index += dollars - 1
  }
  return -1
}

// Applies a narrowly scoped transformation to complete math regions while
// leaving Markdown code and unmatched dollar signs byte-for-byte unchanged.
function transformLatexRegions(
  markdown: string,
  transform: (value: string) => string
): string {
  let output = ""
  let index = 0
  let inlineCodeTicks = 0
  let fence: { marker: "`" | "~"; length: number } | null = null

  while (index < markdown.length) {
    const lineStart = index === 0 || markdown[index - 1] === "\n"
    if (lineStart) {
      const lineEnd = markdown.indexOf("\n", index)
      const end = lineEnd === -1 ? markdown.length : lineEnd
      const line = markdown.slice(index, end)
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)

      if (fenceMatch) {
        const marker = fenceMatch[1][0] as "`" | "~"
        const markerLength = fenceMatch[1].length
        const remainder = fenceMatch[2]
        if (!fence) {
          fence = { marker, length: markerLength }
        } else if (
          marker === fence.marker &&
          markerLength >= fence.length &&
          remainder.trim() === ""
        ) {
          fence = null
        }
        output += markdown.slice(index, lineEnd === -1 ? end : end + 1)
        index = lineEnd === -1 ? end : end + 1
        continue
      }

      if (fence) {
        output += markdown.slice(index, lineEnd === -1 ? end : end + 1)
        index = lineEnd === -1 ? end : end + 1
        continue
      }
    }

    if (markdown[index] === "`") {
      let ticks = 1
      while (markdown[index + ticks] === "`") ticks += 1
      if (inlineCodeTicks === 0) inlineCodeTicks = ticks
      else if (ticks === inlineCodeTicks) inlineCodeTicks = 0
      output += markdown.slice(index, index + ticks)
      index += ticks
      continue
    }

    if (inlineCodeTicks === 0 && markdown[index] === "$" && !isEscaped(markdown, index)) {
      let dollars = 1
      while (markdown[index + dollars] === "$") dollars += 1
      const delimiterLength: 1 | 2 = dollars >= 2 ? 2 : 1
      const contentStart = index + delimiterLength
      const close = closingMathDelimiter(markdown, contentStart, delimiterLength)

      if (close >= contentStart) {
        output += markdown.slice(index, contentStart)
        output += transform(markdown.slice(contentStart, close))
        output += markdown.slice(close, close + delimiterLength)
        index = close + delimiterLength
        continue
      }
    }

    output += markdown[index]
    index += 1
  }

  return output
}

/**
 * Protects LaTeX syntax from Lexical's Markdown unescaping during import.
 * Doubling here is reversed by Lexical before the text reaches the editor.
 */
export function prepareLatexForLexicalImport(markdown: string): string {
  return transformLatexRegions(
    markdown,
    (value) => value.replace(/\\+/g, (run) => run + run)
  )
}

/**
 * Reverses Lexical's Markdown escaping only inside complete `$…$` and `$$…$$`
 * regions. Code spans, fenced code blocks, ordinary Markdown, and unmatched
 * dollar signs are left untouched.
 *
 * This function expects the direct result of `$convertToMarkdownString` and is
 * intentionally not idempotent.
 */
export function restoreLatexAfterLexicalExport(markdown: string): string {
  return transformLatexRegions(
    markdown,
    // Lexical doubles every literal backslash while exporting a plain
    // TextNode. Restore the exact number that was present in the editor.
    (value) => value.replace(
      /\\+/g,
      (run) => "\\".repeat(Math.ceil(run.length / 2))
    )
  )
}
