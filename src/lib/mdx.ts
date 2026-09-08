import "server-only"

import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkRehype from "remark-rehype"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeKatex from "rehype-katex"
import rehypeStringify from "rehype-stringify"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import type { Options as SanitizeSchema } from "rehype-sanitize"
import { SKIP, visit } from "unist-util-visit"
import type { Element, Root, RootContent, Text } from "hast"
import { createHash } from "crypto"
import { fromHtml } from "hast-util-from-html"
import { isHtmlContent, looksLikePublicationHtml, safeEditorialStyle } from "./content-format.js"
import { editorialTextStyle, normalizeEditorialText } from "./editorial-text.js"
import { compilePublicationCss, extractPublicationCss } from "./publication-css"
import { splitInlineCssHooks } from "./inline-css-hooks.js"

type MarkdownImagePolicy =
  | { mode: "none" }
  | {
      mode: "allowlist"
      allowedUrlPrefixes: readonly string[]
      maxImages: number
    }

export type MarkdownRenderOptions = {
  authorImageUrl?: string
  coAuthorImageUrl?: string | null
  defaultImageAlt?: string
  imagePolicy?: MarkdownImagePolicy
  externalLinkRel?: readonly string[]
}

type MdastNode = {
  type: string
  value?: string
  children?: MdastNode[]
}

const AUTHOR_TOKEN_PATTERN = /@autor|@co-autor/g
const DEFAULT_AUTHOR_IMAGE = "/images/profile.jpg"
const MAX_PARAGRAPH_ID_CACHE_ENTRIES = 128
const paragraphIdCache = new Map<string, ReadonlySet<string>>()
const markdownSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "user-content-",
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), "article", "aside", "figure", "figcaption", "footer", "header", "main", "mark", "nav", "small", "time"])],
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    cite: ["http", "https"],
    src: ["http", "https"],
  },
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "dataEditorSafeStyle",
      ["dataCssHook", /^[a-z0-9](?:[a-z0-9-]{0,47})$/],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["dataEditorAlign", "left", "center", "right", "justify"],
      ["dataEditorSize", "auto", "14", "16", "18", "20", "24", "28", "32", "40"],
      ["dataEditorLeading", "auto", "1.2", "1.4", "1.6", "1.8", "2"],
      ["dataEditorSpacing", "auto", "0", "8", "16", "24", "32"],
      ["dataEditorTone", "none", "neutral", "sand", "rose", "blue"],
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ["rel", "ugc", "nofollow", "noopener", "noreferrer"],
      ["target", "_blank"],
      ["dataNoteSourceLink", "post"],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "loading",
      "decoding",
    ],
    figure: [
      ["dataEditorImage", "left", "center", "right"],
      ["dataEditorWidth", ...Array.from({ length: 17 }, (_, i) => String(20 + i * 5))],
      ["dataFlowImage", "left", "right"],
      ["dataFlowWidth", "32", "42", "52"],
      ["dataImageTheme", "adaptive"],
    ],
    p: [
      ...(defaultSchema.attributes?.p ?? []),
      "dataPid",
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["dataRole", "author-reference"],
      ["dataKind", "author", "co-author"],
      ["dataCssHook", /^[a-z0-9](?:[a-z0-9-]{0,47})$/],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
  },
}

const FLOW_IMAGE_SIDES = new Set(["left", "right"])
const FLOW_IMAGE_WIDTHS = new Set(["32", "42", "52"])

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (Array.isArray(value) && value.length > 0) return String(value[0])
  return null
}

function directImageChild(node: Element): Element | null {
  const images = node.children.filter(
    (child): child is Element => child.type === "element" && child.tagName === "img"
  )
  return images.length === 1 ? images[0] : null
}

function rehypeNormalizeFlowImages() {
  return (tree: Root) => {
    let acceptedFlowImage = false
    let acceptedFlowFigure: Element | null = null

    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "figure") return

      const side = stringProperty(node.properties?.dataFlowImage)
      if (["left", "center", "right"].includes(String(node.properties?.dataEditorImage))) return
      const width = stringProperty(node.properties?.dataFlowWidth)
      const theme = stringProperty(node.properties?.dataImageTheme)
      const image = directImageChild(node)
      const valid = Boolean(
        side &&
        width &&
        FLOW_IMAGE_SIDES.has(side) &&
        FLOW_IMAGE_WIDTHS.has(width) &&
        image &&
        !acceptedFlowImage
      )

      node.properties = node.properties ?? {}
      if (!valid) {
        delete node.properties.dataFlowImage
        delete node.properties.dataFlowWidth
        delete node.properties.dataImageTheme
        return
      }

      acceptedFlowImage = true
      acceptedFlowFigure = node
      node.properties.dataFlowImage = side
      node.properties.dataFlowWidth = width
      if (theme === "adaptive") node.properties.dataImageTheme = "adaptive"
      else delete node.properties.dataImageTheme
    })

    // Earlier editor versions could append a contour figure after the last
    // paragraph when the image menu stole focus. A terminal float has no text
    // to affect, so render that legacy shape at the start of the reading flow.
    if (!acceptedFlowFigure) return
    const meaningfulChildren = tree.children.filter((child) => (
      child.type !== "text" || child.value.trim().length > 0
    ))
    if (meaningfulChildren.at(-1) !== acceptedFlowFigure) return

    const firstParagraph = tree.children.find((child): child is Element => (
      child.type === "element" && child.tagName === "p"
    ))
    const figureIndex = tree.children.indexOf(acceptedFlowFigure)
    if (!firstParagraph || figureIndex < 0) return

    tree.children.splice(figureIndex, 1)
    tree.children.splice(tree.children.indexOf(firstParagraph), 0, acceptedFlowFigure)
  }
}

function safeCssUrl(value: string): string {
  return value
    .replace(/\\/g, "%5C")
    .replace(/"/g, "%22")
    .replace(/[\n\r\f]/g, "")
}

function rehypeFlowImageStyles() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "figure") return

      const side = stringProperty(node.properties?.dataFlowImage)
      const width = stringProperty(node.properties?.dataFlowWidth)
      const image = directImageChild(node)
      const source = stringProperty(image?.properties?.src)
      if (
        !side ||
        !width ||
        !source ||
        !FLOW_IMAGE_SIDES.has(side) ||
        !FLOW_IMAGE_WIDTHS.has(width)
      ) return

      node.properties = node.properties ?? {}
      node.properties.style = `--flow-image-width:${width}%;--flow-image-shape:url("${safeCssUrl(source)}")`
    })
  }
}

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

function legacyParagraphId(text: string): string {
  return createHash("sha1")
    .update(text.trim().slice(0, 80))
    .digest("hex")
    .slice(0, 8)
}

function paragraphFingerprint(text: string): string {
  return createHash("sha256")
    .update(text.trim())
    .digest("hex")
    .slice(0, 16)
}

function elementText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === "text") return child.value
      if (child.type === "element") {
        if (child.tagName === "span" && child.properties?.dataRole === "author-reference") {
          return child.properties.dataKind === "co-author" ? "@co-autor" : "@autor"
        }
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

function nextParagraphId(text: string, usedIds: Set<string>, collisionCounts: Map<string, number>): string {
  const legacyId = legacyParagraphId(text)
  if (!usedIds.has(legacyId)) {
    usedIds.add(legacyId)
    return legacyId
  }

  const collisionBase = `${legacyId}-${paragraphFingerprint(text)}`
  let occurrence = collisionCounts.get(collisionBase) ?? 0
  let candidate = collisionBase

  while (usedIds.has(candidate)) {
    occurrence += 1
    candidate = `${collisionBase}-${occurrence + 1}`
  }

  collisionCounts.set(collisionBase, occurrence)
  usedIds.add(candidate)
  return candidate
}

function rehypeParagraphIds(onParagraphId?: (paragraphId: string) => void) {
  return (tree: Root) => {
    const usedIds = new Set<string>()
    const collisionCounts = new Map<string, number>()

    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "p") return
      const text = elementText(node)
      if (text.trim()) {
        const id = nextParagraphId(text, usedIds, collisionCounts)
        node.properties = node.properties ?? {}
        node.properties.dataPid = id
        onParagraphId?.(id)
      }
    })
  }
}

type AllowedImagePrefix = {
  origin: string
  pathname: string
}

function parseAllowedImagePrefix(value: string): AllowedImagePrefix | null {
  try {
    const url = new URL(value)
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return { origin: url.origin, pathname: url.pathname }
  } catch {
    return null
  }
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return true
  if (prefix.endsWith("/")) return pathname.startsWith(prefix)
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function isAllowedImageSource(source: string, prefixes: readonly AllowedImagePrefix[]): boolean {
  try {
    const url = new URL(source)
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return false
    }

    return prefixes.some(
      (prefix) => url.origin === prefix.origin && pathMatchesPrefix(url.pathname, prefix.pathname)
    )
  } catch {
    // Relative URLs are intentionally rejected in restricted content. Besides
    // tracking pixels, an image request can otherwise trigger same-origin GETs.
    return false
  }
}

function rehypeRestrictImages(policy?: MarkdownImagePolicy) {
  if (!policy) return () => undefined

  const prefixes = policy.mode === "allowlist"
    ? policy.allowedUrlPrefixes
        .map(parseAllowedImagePrefix)
        .filter((prefix): prefix is AllowedImagePrefix => prefix !== null)
    : []
  const maxImages = policy.mode === "allowlist" && Number.isFinite(policy.maxImages)
    ? Math.max(0, Math.floor(policy.maxImages))
    : 0

  return (tree: Root) => {
    let imageCount = 0

    visit(tree, "element", (node, index, parent) => {
      const isSource = node.tagName === "source"
      const source = node.tagName === "img" && typeof node.properties?.src === "string"
        ? node.properties.src
        : null
      const imageAllowed = source !== null &&
        imageCount < maxImages &&
        isAllowedImageSource(source, prefixes)

      if (node.tagName === "img" && imageAllowed) {
        imageCount += 1
        return
      }

      if ((node.tagName !== "img" && !isSource) || index === undefined || !parent) return

      const alt = node.tagName === "img" && typeof node.properties?.alt === "string"
        ? node.properties.alt
        : ""
      const replacement = alt ? [{ type: "text" as const, value: alt }] : []
      parent.children.splice(index, 1, ...replacement)
      return [SKIP, index]
    })
  }
}

function rehypeDemoteBodyH1() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "h1") node.tagName = "h2"
    })
  }
}

function rehypeImageAltFallback(defaultImageAlt?: string) {
  return (tree: Root) => {
    if (!defaultImageAlt?.trim()) return
    let imageIndex = 0
    visit(tree, "element", (node: Element, _index, parent) => {
      if (
        node.tagName !== "img" ||
        (parent?.type === "element" && parent.properties?.dataRole === "author-reference")
      ) return
      imageIndex += 1
      const alt = node.properties?.alt
      if (typeof alt === "string" && alt.trim()) return
      node.properties = node.properties ?? {}
      node.properties.alt = imageIndex === 1 ? defaultImageAlt.trim() : `${defaultImageAlt.trim()} (${imageIndex})`
    })
  }
}

function rehypePrefixFragmentLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return
      const href = node.properties?.href
      if (typeof href !== "string" || !href.startsWith("#")) return
      node.properties.href = `#${markdownSanitizeSchema.clobberPrefix ?? "user-content-"}${href.slice(1)}`
    })
  }
}

function rehypeHardenExternalLinks(rel?: readonly string[]) {
  const allowedRel = new Set(["ugc", "nofollow", "noopener", "noreferrer"])
  const tokens = Array.from(new Set(rel?.filter((token) => allowedRel.has(token)) ?? []))
  if (tokens.length === 0) return () => undefined

  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return
      const href = node.properties?.href
      if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return
      node.properties = node.properties ?? {}
      node.properties.rel = tokens
      node.properties.target = "_blank"
    })
  }
}

const NOTE_SOURCE_LINK_LABELS = new Set([
  "Leia o post completo",
  "Continuar lendo no post original",
])
const NOTE_SOURCE_LINK_PREFIX = "Continuar lendo: "

function rehypeMarkNoteSourceLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return
      const href = node.properties?.href
      const label = node.children
        .filter((child) => child.type === "text")
        .map((child) => child.value)
        .join("")
        .trim()

      if (
        typeof href !== "string" ||
        !/^\/(?:[a-z]{2}\/)?posts\//.test(href) ||
        (!NOTE_SOURCE_LINK_LABELS.has(label) && !label.startsWith(NOTE_SOURCE_LINK_PREFIX))
      ) return

      node.properties = node.properties ?? {}
      node.properties.dataNoteSourceLink = "post"
    })
  }
}

function remarkEditorialText() {
  return (tree: MdastNode) => {
    function process(node: MdastNode) {
      if (!node.children) return
      const line = (child: MdastNode) => child.type === "paragraph" && child.children?.length === 1 && child.children[0].type === "text" ? child.children[0].value ?? "" : ""
      for (let i = 0; i < node.children.length; i++) {
        const match = line(node.children[i]).match(/^:::editor (left|center|right|justify) ([\w.]+) ([\w.]+) ([\w.]+) (\w+)$/)
        if (!match) { process(node.children[i]); continue }
        let end = i + 1
        while (end < node.children.length && line(node.children[end]) !== ":::") end++
        if (end === node.children.length) continue
        const [, align, size, leading, spacing, tone] = match
        const p = normalizeEditorialText({ align, size, leading, spacing, tone })
        const wrapper = {
          type: "editorialText",
          data: { hName: "div", hProperties: { dataEditorAlign: p.align, dataEditorSize: p.size, dataEditorLeading: p.leading, dataEditorSpacing: p.spacing, dataEditorTone: p.tone } },
          children: node.children.slice(i + 1, end),
        }
        node.children.splice(i, end - i + 1, wrapper)
      }
    }
    process(tree)
  }
}

// Generate only validated styles after sanitization; authored style attributes
// remain forbidden for all other content.
function rehypeEditorialTextStyles() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "figure" && node.properties.dataEditorImage) {
        const width = Number(node.properties.dataEditorWidth)
        if (!Number.isFinite(width) || width < 20 || width > 100) return
        const alignment = String(node.properties.dataEditorImage)
        const margin = alignment === "left" ? "0 auto 0 0" : alignment === "right" ? "0 0 0 auto" : "0 auto"
        node.properties.style = `width: ${width}%; max-width: 100%; margin: ${margin}`
        return
      }
      if (node.tagName !== "div" || !node.properties.dataEditorAlign) return
      const p = normalizeEditorialText({
        align: String(node.properties.dataEditorAlign), size: String(node.properties.dataEditorSize),
        leading: String(node.properties.dataEditorLeading), spacing: String(node.properties.dataEditorSpacing), tone: String(node.properties.dataEditorTone),
      })
      node.properties.style = `${editorialTextStyle(p)}; text-align: ${p.align}`
      for (const child of node.children) {
        if (child.type !== "element") continue
        child.properties.style = `${editorialTextStyle({ ...p, tone: "none", spacing: "auto" })}; text-align: ${p.align}`
      }
    })
  }
}

function rehypeSafeEditorialStyles(html: boolean, restore: boolean) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (restore) {
        const style = html ? safeEditorialStyle(String(node.properties.dataEditorSafeStyle ?? "")) : ""
        delete node.properties.dataEditorSafeStyle
        if (style) node.properties.style = style
      } else {
        delete node.properties.dataEditorSafeStyle
        const style = html ? safeEditorialStyle(String(node.properties.style ?? "")) : ""
        if (style) node.properties.dataEditorSafeStyle = style
      }
    })
  }
}

function rehypeInlineCssHooks() {
  return (tree: Root) => {
    const occurrences = new Map<string, number>()
    visit(tree, "text", (node: Text, index, parent) => {
      if (index === undefined || !parent) return
      if (parent.type === "element" && ["code", "pre", "style"].includes(parent.tagName)) return

      const parts = splitInlineCssHooks(node.value, occurrences)
      if (!parts.some(part => part.type === "hook")) return
      const children = parts.map(part => part.type === "text"
        ? { type: "text" as const, value: part.value }
        : {
            type: "element" as const,
            tagName: "span",
            properties: { dataCssHook: part.id },
            children: [{ type: "text" as const, value: part.text }],
          })
      parent.children.splice(index, 1, ...children)
      return [SKIP, index + children.length]
    })
  }
}

const EDITOR_SOURCE_BREAK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "div", "dl", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav",
  "ol", "p", "pre", "section", "table", "ul",
])

function textFromEscapedEditorNode(node: RootContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  if (node.tagName === "br") return "\n"
  const text = node.children.map(textFromEscapedEditorNode).join("")
  return EDITOR_SOURCE_BREAK_TAGS.has(node.tagName) ? `${text}\n\n` : text
}

function escapedHtmlSource(document: Element): string | null {
  if (document.properties.dataEditorSource === "raw") return null
  const source = document.children.map(textFromEscapedEditorNode).join("").trim()
  return looksLikePublicationHtml(source) ? source : null
}

function createProcessor(
  options: MarkdownRenderOptions = {},
  onParagraphId?: (paragraphId: string) => void,
  html = false,
) {
  const processor = unified()
  if (html) {
    processor.use(function () {
      this.parser = value => {
        const tree = fromHtml(value, { fragment: true })
        const document = tree.children.find((node): node is Element => node.type === "element" && node.properties.dataEditorDocument === "html")
        if (!document) return tree
        const escapedSource = escapedHtmlSource(document)
        return escapedSource
          ? fromHtml(escapedSource, { fragment: true })
          : { type: "root", children: document.children }
      }
    })
  } else {
    processor
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkEditorialText)
    .use(remarkAuthorReferences, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
  }
  if (html) processor.use(rehypeInlineCssHooks)
  processor
    .use(function () { return rehypeSafeEditorialStyles(html, false) })
    .use(rehypeNormalizeFlowImages)
    .use(rehypeRestrictImages, options.imagePolicy)
    .use(rehypeImageAltFallback, options.defaultImageAlt)
    .use(rehypeParagraphIds, onParagraphId)
  if (!html) processor.use(rehypeDemoteBodyH1)
  return processor
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypePrefixFragmentLinks)
    .use(rehypeHardenExternalLinks, options.externalLinkRel)
    .use(rehypeMarkNoteSourceLinks)
    .use(rehypeSanitize, markdownSanitizeSchema)
    .use(function () { return rehypeSafeEditorialStyles(html, true) })
    // KaTeX runs after untrusted HTML is sanitized. It emits complete HTML and
    // MathML on the server, so formulas need no JavaScript in the browser.
    .use(rehypeKatex, {
      maxExpand: 1000,
      maxSize: 20,
      strict: "error",
    })
    .use(rehypeFlowImageStyles)
    .use(rehypeEditorialTextStyles)
    .use(rehypeStringify)
}

function withPublicationCss(renderedHtml: string, source: string, html: boolean): string {
  if (!html) return renderedHtml

  const css = extractPublicationCss(source)
  if (!css.trim()) return renderedHtml

  const id = createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, 16)
  const marker = `style[data-publication-css="${id}"]`
  const surface = `:where(.post-content, .note-content:not(.comment-content), .personal-timeline-content):has(> ${marker})`

  try {
    const stylesheet = compilePublicationCss(css, surface)
    return `${renderedHtml}<style data-publication-css="${id}">${stylesheet}</style>`
  } catch {
    // Keep an unfinished stylesheet in the editor draft without allowing it to
    // break public rendering. It becomes active as soon as it parses cleanly.
    return renderedHtml
  }
}

export async function renderMarkdown(content: string, options: MarkdownRenderOptions = {}): Promise<string> {
  const html = isHtmlContent(content)
  const result = await createProcessor(options, undefined, html).process(content)
  return withPublicationCss(String(result), content, html)
}

export function renderMarkdownSync(content: string, options: MarkdownRenderOptions = {}): string {
  const html = isHtmlContent(content)
  const result = createProcessor(options, undefined, html).processSync(content)
  return withPublicationCss(String(result), content, html)
}

export function extractParagraphIds(content: string, options: MarkdownRenderOptions = {}): string[] {
  const paragraphIds: string[] = []
  createProcessor(options, (paragraphId) => paragraphIds.push(paragraphId), isHtmlContent(content)).processSync(content)
  return paragraphIds
}

export function hasParagraphId(
  content: string,
  paragraphId: string,
  options: MarkdownRenderOptions = {}
): boolean {
  if (!paragraphId || paragraphId.length > 120) return false
  const optionsKey = JSON.stringify({
    authorImageUrl: options.authorImageUrl ?? null,
    coAuthorImageUrl: options.coAuthorImageUrl ?? null,
    defaultImageAlt: options.defaultImageAlt ?? null,
    imagePolicy: options.imagePolicy ?? null,
    externalLinkRel: options.externalLinkRel ?? null,
  })
  const cacheKey = createHash("sha256")
    .update(optionsKey)
    .update("\0")
    .update(content)
    .digest("hex")
  let ids = paragraphIdCache.get(cacheKey)

  if (!ids) {
    ids = new Set(extractParagraphIds(content, options))
    paragraphIdCache.set(cacheKey, ids)
    if (paragraphIdCache.size > MAX_PARAGRAPH_ID_CACHE_ENTRIES) {
      const oldestKey = paragraphIdCache.keys().next().value
      if (oldestKey) paragraphIdCache.delete(oldestKey)
    }
  }

  return ids.has(paragraphId)
}
