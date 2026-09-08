"use client"

import { useEffect, type RefObject } from "react"
import {
  layoutNextRichInlineLineRange,
  materializeRichInlineLineRange,
  prepareRichInline,
  type RichInlineCursor,
  type RichInlineItem,
} from "@chenglou/pretext/rich-inline"
import { measureFlowImageAlpha } from "./FlowImageAlphaOffset"
import type { FlowImageAlphaGeometry } from "./flow-image-alpha"
import { lineSlotForAlphaBand, stabilizePaintedLine, type FlowSide } from "./flow-image-layout"

type InlineSource = { node: Text; text: string }
type ParagraphTemplate = { element: HTMLParagraphElement; nodes: Node[] }
type PositionedFragment = { gapBefore: number; left: number; lineIndex: number; text: string; top: number }
type FlowFigure = {
  figure: HTMLElement
  geometry: FlowImageAlphaGeometry | null
  image: HTMLImageElement
  paragraphs: ParagraphTemplate[]
  root: HTMLElement
  side: FlowSide
}

const MIN_LINE_WIDTH = 24
const LINE_WIDTH_GUARD = 4
const MAX_GENERATED_LINES = 2_000
const SUPPORTED_INLINE_TAGS = new Set([
  "A", "B", "CODE", "DEL", "EM", "I", "KBD", "MARK", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP",
])

function parsePixelValue(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function canvasFont(style: CSSStyleDeclaration) {
  const variant = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal"
  return [style.fontStyle || "normal", variant, style.fontWeight || "400", style.fontSize || "16px", style.fontFamily || "sans-serif"].join(" ")
}

function isSupportedParagraph(paragraph: HTMLParagraphElement) {
  return Array.from(paragraph.querySelectorAll("*")).every(element => SUPPORTED_INLINE_TAGS.has(element.tagName))
}

function directFlowParagraphs(figure: HTMLElement) {
  const paragraphs: HTMLParagraphElement[] = []
  let sibling = figure.nextElementSibling
  while (sibling instanceof HTMLParagraphElement) {
    paragraphs.push(sibling)
    sibling = sibling.nextElementSibling
  }
  return paragraphs
}

function cloneNodes(nodes: Node[]) {
  return nodes.map(node => node.cloneNode(true))
}

function restoreParagraph(template: ParagraphTemplate) {
  template.element.replaceChildren(...cloneNodes(template.nodes))
  template.element.removeAttribute("data-pretext-flow-rendered")
  template.element.style.removeProperty("height")
}

function collectInlineSources(paragraph: HTMLParagraphElement): { items: RichInlineItem[]; sources: InlineSource[] } | null {
  if (!isSupportedParagraph(paragraph)) return null
  const items: RichInlineItem[] = []
  const sources: InlineSource[] = []
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const textNode = node as Text
    if (textNode.data.length > 0) {
      const parent = textNode.parentElement
      if (!parent) return null
      const style = window.getComputedStyle(parent)
      const letterSpacing = parsePixelValue(style.letterSpacing, Number.NaN)
      items.push({
        text: textNode.data,
        font: canvasFont(style),
        letterSpacing: Number.isFinite(letterSpacing) ? letterSpacing : undefined,
      })
      sources.push({ node: textNode, text: textNode.data })
    }
    node = walker.nextNode()
  }
  return items.length ? { items, sources } : null
}

function edgeWhitespace(text: string, edge: "start" | "end") {
  return edge === "start" ? text.match(/^\s+/)?.[0] ?? "" : text.match(/\s+$/)?.[0] ?? ""
}

function projectFragments(
  paragraph: HTMLParagraphElement,
  sources: InlineSource[],
  positioned: PositionedFragment[][],
  lineCount: number,
  lineHeight: number
) {
  paragraph.dataset.pretextFlowRendered = "true"
  paragraph.style.height = `${Math.max(0, lineCount * lineHeight).toFixed(2)}px`
  for (let itemIndex = 0; itemIndex < sources.length; itemIndex += 1) {
    const source = sources[itemIndex]
    if (!source) continue
    const replacement = document.createDocumentFragment()
    const appendSpace = (text: string) => {
      if (!text) return
      const space = document.createElement("span")
      space.className = "pretext-flow-preserved-space"
      space.textContent = text
      replacement.append(space)
    }
    if (!source.text.trim()) {
      appendSpace(source.text)
      source.node.replaceWith(replacement)
      continue
    }
    appendSpace(edgeWhitespace(source.text, "start"))
    for (const fragment of positioned[itemIndex] ?? []) {
      const span = document.createElement("span")
      span.className = "pretext-flow-fragment"
      span.dataset.pretextGapBefore = fragment.gapBefore.toFixed(2)
      span.dataset.pretextLine = String(fragment.lineIndex)
      span.style.setProperty("--pretext-fragment-left", `${fragment.left.toFixed(2)}px`)
      span.style.setProperty("--pretext-fragment-top", `${fragment.top.toFixed(2)}px`)
      span.textContent = fragment.text
      replacement.append(span)
    }
    appendSpace(edgeWhitespace(source.text, "end"))
    source.node.replaceWith(replacement)
  }

  const lines = new Map<number, HTMLElement[]>()
  for (const fragment of paragraph.querySelectorAll<HTMLElement>(".pretext-flow-fragment")) {
    const lineIndex = Number.parseInt(fragment.dataset.pretextLine ?? "", 10)
    if (!Number.isFinite(lineIndex)) continue
    const line = lines.get(lineIndex) ?? []
    line.push(fragment)
    lines.set(lineIndex, line)
  }
  for (const line of lines.values()) {
    line.sort((a, b) => parsePixelValue(a.style.getPropertyValue("--pretext-fragment-left")) - parsePixelValue(b.style.getPropertyValue("--pretext-fragment-left")))
    const corrected = stabilizePaintedLine(line.map(fragment => ({
      gapBefore: parsePixelValue(fragment.dataset.pretextGapBefore ?? "0"),
      left: parsePixelValue(fragment.style.getPropertyValue("--pretext-fragment-left")),
      width: fragment.getBoundingClientRect().width,
    })))
    line.forEach((fragment, index) => fragment.style.setProperty("--pretext-fragment-left", `${corrected[index]?.toFixed(2) ?? "0"}px`))
  }
}

function layoutParagraph({
  paragraph,
  geometry,
  side,
  containerWidth,
  imageTop,
  imageHeight,
  imageLeft,
  imageWidth,
  shapeMargin,
}: {
  paragraph: HTMLParagraphElement
  geometry: FlowImageAlphaGeometry
  side: FlowSide
  containerWidth: number
  imageTop: number
  imageHeight: number
  imageLeft: number
  imageWidth: number
  shapeMargin: number
}) {
  const source = collectInlineSources(paragraph)
  if (!source) return false
  const prepared = prepareRichInline(source.items)
  const paragraphTop = paragraph.offsetTop
  const paragraphLeft = paragraph.offsetLeft
  const style = window.getComputedStyle(paragraph)
  const fontSize = parsePixelValue(style.fontSize, 16)
  const lineHeight = parsePixelValue(style.lineHeight, fontSize * 1.5)
  const positioned: PositionedFragment[][] = source.sources.map(() => [])
  let cursor: RichInlineCursor = { itemIndex: 0, segmentIndex: 0, graphemeIndex: 0 }
  let lineIndex = 0
  while (lineIndex < MAX_GENERATED_LINES) {
    const bandTop = paragraphTop + lineIndex * lineHeight
    const slot = lineSlotForAlphaBand({
      geometry, side, containerWidth, bandTop, bandBottom: bandTop + lineHeight,
      imageTop, imageHeight, imageLeft, imageWidth, shapeMargin,
    })
    if (slot.width < MIN_LINE_WIDTH) {
      lineIndex += 1
      continue
    }
    const range = layoutNextRichInlineLineRange(prepared, Math.max(1, slot.width - LINE_WIDTH_GUARD), cursor)
    if (!range) break
    const line = materializeRichInlineLineRange(prepared, range)
    let inlineOffset = 0
    for (const fragment of line.fragments) {
      inlineOffset += fragment.gapBefore
      positioned[fragment.itemIndex]?.push({
        gapBefore: fragment.gapBefore,
        left: slot.left - paragraphLeft + inlineOffset,
        lineIndex,
        text: fragment.text,
        top: lineIndex * lineHeight,
      })
      inlineOffset += fragment.occupiedWidth
    }
    cursor = range.end
    lineIndex += 1
  }
  if (lineIndex >= MAX_GENERATED_LINES) return false
  projectFragments(paragraph, source.sources, positioned, lineIndex, lineHeight)
  return true
}

function styleSignature(container: HTMLElement, figures: FlowFigure[]) {
  const style = window.getComputedStyle(container)
  return [
    container.clientWidth,
    style.fontSize,
    style.lineHeight,
    style.letterSpacing,
    document.documentElement.className,
    ...figures.flatMap(item => [
      item.figure.getBoundingClientRect().width,
      item.figure.dataset.imageGap,
      item.figure.dataset.imageWidth,
      item.figure.dataset.imageUnit,
      ...item.paragraphs.map(({ element }) => window.getComputedStyle(element).font),
    ]),
  ].join("\u0000")
}

/** Recreates Pretext's variable-width line layout around transparent image pixels. */
export function usePretextImageFlow(containerRef: RefObject<HTMLElement | null>, contentKey: string) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const abortController = new AbortController()
    const figures: FlowFigure[] = Array.from(container.querySelectorAll<HTMLElement>("figure[data-flow-image]"))
      .flatMap(figure => {
        const image = figure.querySelector<HTMLImageElement>(":scope > img")
        const side = figure.dataset.flowImage
        const root = figure.parentElement
        const paragraphs = directFlowParagraphs(figure)
        if (!image || !root || (side !== "left" && side !== "right") || figure.querySelector("figcaption") || !paragraphs.length || paragraphs.some(paragraph => !isSupportedParagraph(paragraph))) return []
        return [{ figure, image, root, side, geometry: null, paragraphs: paragraphs.map(element => ({ element, nodes: cloneNodes(Array.from(element.childNodes)) })) }]
      })
    if (!figures.length) return

    let disposed = false
    let scheduledFrame = 0
    let lastSignature = ""
    const roots = [...new Set(figures.map(item => item.root))]
    const restore = () => {
      for (const item of figures) {
        for (const paragraph of item.paragraphs) restoreParagraph(paragraph)
        item.figure.removeAttribute("data-pretext-flow-active")
        item.figure.style.removeProperty("--pretext-flow-image-top")
        item.figure.style.removeProperty("--flow-image-outer-alpha-offset")
      }
      for (const root of roots) {
        root.removeAttribute("data-pretext-flow-root")
        root.style.removeProperty("--pretext-flow-min-height")
      }
    }

    const render = (force = false) => {
      const signature = styleSignature(container, figures)
      if (!force && signature === lastSignature) return
      lastSignature = signature
      restore()
      const measurements = figures.flatMap(item => {
        if (!item.geometry || item.root.clientWidth < 480 || window.getComputedStyle(item.figure).float === "none") return []
        const rootRect = item.root.getBoundingClientRect()
        const figureRect = item.figure.getBoundingClientRect()
        const imageWidth = figureRect.width
        const imageHeight = imageWidth * (item.geometry.height / item.geometry.width)
        if (!imageWidth || !imageHeight) return []
        return [{ item, imageWidth, imageHeight, imageTop: figureRect.top - rootRect.top }]
      })
      if (!measurements.length) return
      for (const root of roots) root.dataset.pretextFlowRoot = "true"
      for (const measurement of measurements) {
        const { item, imageWidth, imageHeight, imageTop } = measurement
        const geometry = item.geometry!
        const containerWidth = item.root.clientWidth
        const outerOffset = imageWidth * geometry[item.side]
        const imageLeft = item.side === "left" ? -outerOffset : containerWidth + outerOffset - imageWidth
        const shapeMargin = parsePixelValue(window.getComputedStyle(item.figure).getPropertyValue("--image-gap"), 16)
        item.figure.dataset.pretextFlowActive = "true"
        item.figure.style.setProperty("--pretext-flow-image-top", `${imageTop.toFixed(2)}px`)
        item.figure.style.setProperty("--flow-image-outer-alpha-offset", `${outerOffset.toFixed(2)}px`)
        let valid = true
        for (const template of item.paragraphs) {
          if (!layoutParagraph({
            paragraph: template.element,
            geometry,
            side: item.side,
            containerWidth,
            imageTop,
            imageHeight,
            imageLeft,
            imageWidth,
            shapeMargin,
          })) {
            valid = false
            break
          }
        }
        if (!valid) {
          for (const paragraph of item.paragraphs) restoreParagraph(paragraph)
          item.figure.removeAttribute("data-pretext-flow-active")
          continue
        }
        const currentMin = parsePixelValue(item.root.style.getPropertyValue("--pretext-flow-min-height"))
        item.root.style.setProperty("--pretext-flow-min-height", `${Math.ceil(Math.max(currentMin, imageTop + imageHeight))}px`)
      }
    }

    const schedule = (force = false) => {
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame)
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0
        render(force)
      })
    }
    const resizeObserver = new ResizeObserver(() => schedule())
    resizeObserver.observe(container)
    figures.forEach(item => resizeObserver.observe(item.figure))
    const themeObserver = new MutationObserver(() => schedule(true))
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    const refresh = () => schedule(true)
    document.fonts.addEventListener("loadingdone", refresh)
    window.addEventListener("readingpreferenceschange", refresh)
    figures.forEach(item => {
      const source = item.image.currentSrc || item.image.src
      void measureFlowImageAlpha(source, abortController.signal).then(geometry => {
        if (disposed || !geometry) return
        item.geometry = geometry
        schedule(true)
      })
    })
    return () => {
      disposed = true
      abortController.abort()
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      document.fonts.removeEventListener("loadingdone", refresh)
      window.removeEventListener("readingpreferenceschange", refresh)
      restore()
    }
  }, [containerRef, contentKey])
}
