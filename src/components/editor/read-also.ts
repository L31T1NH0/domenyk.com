import { $createLinkNode } from "@lexical/link"
import { $createParagraphNode, $createTextNode } from "lexical"

export function readAlsoUrl(value: string): string | null {
  const href = value.trim()
  if (!href || /[\s\\]/.test(href)) return null
  if (href.startsWith("/") && !href.startsWith("//")) return href
  try {
    const url = new URL(href)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export function $createReadAlsoParagraph(href: string, title: string) {
  // A standard link title survives both HTML and Markdown save/reopen cycles.
  return $createParagraphNode().append(
    $createLinkNode(href, { title: "Leia também" }).append($createTextNode(title.trim()))
  )
}
