import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html"
import { $getRoot, $isElementNode, $isTextNode, ParagraphNode, TextNode, type HTMLConfig, type LexicalEditor, type DOMConversionMap, type DOMExportOutputMap, type LexicalNode } from "lexical"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListNode, ListItemNode } from "@lexical/list"
import { CodeNode } from "@lexical/code"
import { $createMarkNode, MarkNode } from "@lexical/mark"
import { looksLikePublicationHtml, MAX_RICH_CONTENT_LENGTH, safeEditorialStyle } from "@/lib/content-format"
import { createState, $getState, $setState } from "lexical"
import { safeImageStyle } from "@/lib/content-images"
import { compilePublicationCss } from "@/lib/publication-css"

export const publicationCssState = createState("publicationCss", {
  parse: value => typeof value === "string" ? value : "",
})
export const publicationHtmlSourceState = createState("publicationHtmlSource", {
  parse: (value): string | null => typeof value === "string" ? value.slice(0, MAX_RICH_CONTENT_LENGTH) : null,
})

const styledNodes = [ParagraphNode, HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, TextNode]
const imports: DOMConversionMap = {}
const exports: DOMExportOutputMap = new Map()
for (const klass of styledNodes) {
  exports.set(klass, (editor, node) => {
    if (node instanceof ParagraphNode && node.getChildrenSize() === 1 && node.getFirstChild()?.getType() === "image") {
      return { element: document.createDocumentFragment() }
    }
    const result = node.exportDOM(editor)
    if (result.element instanceof HTMLElement) {
      // Keep content formatting, never editor-only theme classes.
      result.element.removeAttribute("class")
      if ($isElementNode(node) || $isTextNode(node)) {
        const style = safeEditorialStyle(`${result.element.getAttribute("style") ?? ""};${node.getStyle()}`)
        if (style) result.element.setAttribute("style", style)
      }
    }
    return result
  })
  for (const [tag, factory] of Object.entries(klass.importDOM?.() ?? {})) {
    imports[tag] = element => {
      const original = factory(element)
      if (!original) return null
      return {
        priority: 2,
        conversion(dom) {
          const result = original.conversion(dom)
          if (!result) return null
          // TextNode's #text importer also passes through this adapter.
          // Only element nodes carry HTML attributes.
          const style = dom.nodeType === 1
            ? safeEditorialStyle(dom.getAttribute("style") ?? "")
            : ""
          const apply = (node: LexicalNode | null | undefined) => {
            if (style && ($isElementNode(node) || $isTextNode(node))) node.setStyle(safeEditorialStyle(`${style};${node.getStyle()}`))
            return node
          }
          if (Array.isArray(result.node)) result.node.forEach(apply)
          else apply(result.node)
          return { ...result, forChild: (child, parent) => {
            const converted = result.forChild ? result.forChild(child, parent) : child
            // Span styles belong to inline text, not nested paragraph blocks.
            return result.node === null ? apply(converted) : converted
          } }
        },
      }
    }
  }
}

exports.set(MarkNode, (_editor, node) => {
  if (!(node instanceof MarkNode)) return { element: null }
  const element = document.createElement("span")
  const id = node.getIDs()[0]
  if (id) element.setAttribute("data-css-hook", id)
  return { element }
})

const importSpan = imports.span
imports.span = element => {
  const id = element.getAttribute("data-css-hook")
  if (id && /^[a-z0-9](?:[a-z0-9-]{0,47})$/.test(id)) {
    return { priority: 4, conversion: () => ({ node: $createMarkNode([id]) }) }
  }
  return importSpan?.(element) ?? null
}
export const editorialHtmlConfig: HTMLConfig = { import: imports, export: exports }

function inferredHtmlSource() {
  const root = $getRoot()
  if (root.getAllTextNodes().some(node => node.hasFormat("code"))) return null
  if (root.getChildren().some(node => node instanceof CodeNode)) return null
  const text = root.getTextContent().trim()
  return looksLikePublicationHtml(text) ? text : null
}

export function readHtmlBodyFromEditor(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => (
    $getState($getRoot(), publicationHtmlSourceState) ?? inferredHtmlSource() ?? $generateHtmlFromNodes(editor, null)
  ))
}

export function readHtmlFromEditor(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => {
    const root = $getRoot()
    const source = $getState(root, publicationHtmlSourceState) ?? inferredHtmlSource()
    const hasImage = root.getChildren().some(node => node.getType() === "image" || ($isElementNode(node) && node.getChildren().some(child => child.getType() === "image")))
    if (source === null && !root.getTextContent().trim() && !hasImage) return ""
    if (source !== null && !source.trim()) return ""
    const css = $getState(root, publicationCssState)
    const stylesheet = css ? `<template data-editor-css="${encodeURIComponent(css)}"></template>` : ""
    const sourceMode = source === null ? "" : ' data-editor-source="raw"'
    return `<div data-editor-document="html"${sourceMode}>${stylesheet}${source ?? $generateHtmlFromNodes(editor, null)}</div>`
  })
}

export function assertPublicationCssIsValid(editor: LexicalEditor) {
  const css = editor.getEditorState().read(() => $getState($getRoot(), publicationCssState))
  try {
    compilePublicationCss(css, "[data-publication-validation]")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confira o CSS da publicação."
    throw new Error(`CSS da publicação: ${message}`)
  }
}

export function beginHtmlSourceMode(editor: LexicalEditor): string {
  const source = readHtmlBodyFromEditor(editor)
  editor.update(() => $setState($getRoot(), publicationHtmlSourceState, source), { discrete: true })
  return source
}

export function updateHtmlSource(editor: LexicalEditor, source: string) {
  editor.update(() => $setState($getRoot(), publicationHtmlSourceState, source.slice(0, MAX_RICH_CONTENT_LENGTH)))
}

/** Refuse structures/attributes the visual model cannot round-trip. */
export function canEditHtmlVisually(source: string): boolean {
  const doc = new DOMParser().parseFromString(source, "text/html")
  const supported = new Set(["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li", "pre", "code", "a", "strong", "b", "em", "i", "u", "s", "span", "figure", "img", "figcaption"])
  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase()
    if (!supported.has(tag)) return false
    const imagePart = ["figure", "img", "figcaption"].includes(tag)
    for (const attr of Array.from(element.attributes)) {
      if (attr.name === "style") {
        // Unsafe/unsupported declarations stay in source; never silently discard them.
        const sanitizer = imagePart ? safeImageStyle : safeEditorialStyle
        if (attr.value.split(";").filter(value => value.trim()).some(value => !sanitizer(value))) return false
      } else if (attr.name === "class" && imagePart) continue
      else if (imagePart && /^(?:src|alt|width|height|data-(?:flow-(?:image|width)|editor-(?:image|width)|image-(?:theme|width|unit|gap)))$/.test(attr.name)) continue
      else if (tag === "a" && ["href", "rel", "target", "title"].includes(attr.name)) continue
      else if (tag === "span" && attr.name === "data-css-hook") continue
      else if (tag === "ol" && attr.name === "start") continue
      else return false
    }
    if (tag === "figure") {
      if (element.parentElement !== doc.body || element.querySelectorAll("img").length !== 1) return false
      if (Array.from(element.children).some(child => !["IMG", "FIGCAPTION"].includes(child.tagName))) return false
      if (Array.from(element.childNodes).some(child => child.nodeType === 3 && child.textContent?.trim())) return false
    }
    if (tag === "figcaption" && (element.parentElement?.tagName !== "FIGURE" || element.children.length)) return false
    if (tag === "img" && element.parentElement !== doc.body && element.parentElement?.tagName !== "FIGURE" && !(element.parentElement?.tagName === "P" && element.parentElement.children.length === 1 && !element.parentElement.textContent?.trim())) return false
  }
  return true
}

export function applyHtmlSourceToVisualEditor(editor: LexicalEditor) {
  const source = editor.getEditorState().read(() => $getState($getRoot(), publicationHtmlSourceState))
  if (source === null) return
  if (!canEditHtmlVisually(source)) throw new Error("Este HTML contém recursos que o editor visual não representa. Continue no modo código; a prévia mostra a publicação.")
  const document = new DOMParser().parseFromString(source, "text/html")
  editor.update(() => {
    const root = $getRoot()
    const css = $getState(root, publicationCssState)
    const nodes = $generateNodesFromDOM(editor, document)
    root.clear().append(...nodes)
    $setState(root, publicationCssState, css)
    $setState(root, publicationHtmlSourceState, null)
  }, { discrete: true })
}

export function importHtmlIntoEditor(editor: LexicalEditor, content: string) {
  const document = new DOMParser().parseFromString(content, "text/html")
  const wrapper = document.querySelector<HTMLElement>('[data-editor-document="html"]')
  const stylesheet = document.querySelector("template[data-editor-css]")
  let css = ""
  try { css = decodeURIComponent(stylesheet?.getAttribute("data-editor-css") ?? "") } catch { /* Ignore malformed stylesheet metadata. */ }
  document.querySelectorAll("template[data-editor-css]").forEach(node => node.remove())
  const body = wrapper?.innerHTML ?? document.body.innerHTML
  const rawSource = wrapper?.dataset.editorSource === "raw" || !canEditHtmlVisually(body) ? body : null
  const nodes = $generateNodesFromDOM(editor, document)
  $getRoot().clear().append(...nodes)
  $setState($getRoot(), publicationCssState, css)
  $setState($getRoot(), publicationHtmlSourceState, rawSource)
}
