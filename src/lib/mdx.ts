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

type MarkdownRenderOptions = {
  authorImageUrl?: string
  coAuthorImageUrl?: string | null
}

type MdastNode = {
  type: string
  value?: string
  children?: MdastNode[]
}

const AUTHOR_TOKEN_PATTERN = /@autor|@co-autor/g
const DEFAULT_AUTHOR_IMAGE = "/images/profile.jpg"

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function authorReferenceHtml(kind: "author" | "co-author", src?: string | null): string {
  const safeSrc = src ? escapeHtmlAttribute(src) : ""
  const image = safeSrc
    ? `<img src="${safeSrc}" alt="" loading="lazy" decoding="async" />`
    : ""

  return `<span data-role="author-reference" data-kind="${kind}">${image}</span>`
}

function remarkAuthorReferences(options: MarkdownRenderOptions = {}) {
  return (tree: MdastNode) => {
    visit(tree, "paragraph", (paragraph: MdastNode, _index, parent: MdastNode | undefined) => {
      if (parent?.type === "blockquote") return

      const children = paragraph.children ?? []
      const nextChildren: MdastNode[] = []
      let changed = false

      for (const child of children) {
        if (child.type !== "text" || typeof child.value !== "string") {
          nextChildren.push(child)
          continue
        }

        const segments: MdastNode[] = []
        let lastIndex = 0
        const matcher = new RegExp(AUTHOR_TOKEN_PATTERN.source, AUTHOR_TOKEN_PATTERN.flags)
        let match: RegExpExecArray | null

        while ((match = matcher.exec(child.value)) !== null) {
          const [token] = match
          const matchIndex = match.index

          if (matchIndex > lastIndex) {
            segments.push({ type: "text", value: child.value.slice(lastIndex, matchIndex) })
          }

          if (token === "@co-autor") {
            segments.push({
              type: "html",
              value: authorReferenceHtml("co-author", options.coAuthorImageUrl),
            })
          } else {
            segments.push({
              type: "html",
              value: authorReferenceHtml("author", options.authorImageUrl ?? DEFAULT_AUTHOR_IMAGE),
            })
          }

          lastIndex = matchIndex + token.length
          changed = true
        }

        if (lastIndex === 0) {
          nextChildren.push(child)
          continue
        }

        if (lastIndex < child.value.length) {
          segments.push({ type: "text", value: child.value.slice(lastIndex) })
        }

        nextChildren.push(...segments)
      }

      if (changed) paragraph.children = nextChildren
    })
  }
}

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

function createProcessor(options: MarkdownRenderOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAuthorReferences, options)
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
          "decoding",
        ],
        span: [
          ...(defaultSchema.attributes?.span ?? []),
          ["data-role", "author-reference"],
          ["data-kind", "author"],
          ["data-kind", "co-author"],
        ],
      },
    })
    .use(rehypeParagraphIds)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeStringify)
}

export async function renderMarkdown(content: string, options: MarkdownRenderOptions = {}): Promise<string> {
  const result = await createProcessor(options).process(content)
  return String(result)
}

export function renderMarkdownSync(content: string, options: MarkdownRenderOptions = {}): string {
  const result = createProcessor(options).processSync(content)
  return String(result)
}
