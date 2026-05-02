import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeStringify from "rehype-stringify"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import { visit } from "unist-util-visit"
import type { Element, Root } from "hast"
import { createHash } from "crypto"

function paragraphId(text: string): string {
  return createHash("sha1")
    .update(text.trim().slice(0, 80))
    .digest("hex")
    .slice(0, 8)
}

function elementText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === "text") return child.value
      if (child.type === "element") {
        if (child.tagName === "img") {
          const src = child.properties?.src
          return typeof src === "string" ? src : ""
        }
        return elementText(child)
      }
      return ""
    })
    .join("")
}

function rehypeParagraphIds() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "p") return
      const text = elementText(node)
      if (text.trim()) {
        node.properties = node.properties ?? {}
        node.properties["data-pid"] = paragraphId(text)
      }
    })
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      a: [
        ...(defaultSchema.attributes?.a ?? []),
        ["rel", "nofollow"],
        ["target", "_blank"],
      ],
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        "loading",
      ],
    },
  })
  .use(rehypeParagraphIds)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap" })
  .use(rehypeStringify)

export async function renderMarkdown(content: string): Promise<string> {
  const result = await processor.process(content)
  return String(result)
}

export function renderMarkdownSync(content: string): string {
  const result = processor.processSync(content)
  return String(result)
}
