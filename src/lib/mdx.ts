import "server-only"

import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeStringify from "rehype-stringify"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import type { Options as SanitizeSchema } from "rehype-sanitize"
import { SKIP, visit } from "unist-util-visit"
import type { Element, Root } from "hast"
import { createHash } from "crypto"

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
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    cite: ["http", "https"],
    src: ["http", "https"],
  },
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ["rel", "ugc", "nofollow", "noopener", "noreferrer"],
      ["target", "_blank"],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "loading",
      "decoding",
    ],
    p: [
      ...(defaultSchema.attributes?.p ?? []),
      "dataPid",
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["dataRole", "author-reference"],
      ["dataKind", "author", "co-author"],
    ],
  },
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

function createProcessor(
  options: MarkdownRenderOptions = {},
  onParagraphId?: (paragraphId: string) => void
) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAuthorReferences, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeRestrictImages, options.imagePolicy)
    .use(rehypeImageAltFallback, options.defaultImageAlt)
    .use(rehypeParagraphIds, onParagraphId)
    .use(rehypeDemoteBodyH1)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypePrefixFragmentLinks)
    .use(rehypeHardenExternalLinks, options.externalLinkRel)
    .use(rehypeSanitize, markdownSanitizeSchema)
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

export function extractParagraphIds(content: string, options: MarkdownRenderOptions = {}): string[] {
  const paragraphIds: string[] = []
  createProcessor(options, (paragraphId) => paragraphIds.push(paragraphId)).processSync(content)
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
