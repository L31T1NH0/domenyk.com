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

function styleSignature(container: HTMLElement, figure: HTMLElement, paragraphs: HTMLParagraphElement[]) {
  const style = window.getComputedStyle(container)
  return [
    container.clientWidth,
    figure.getBoundingClientRect().width,
    style.fontSize,
    style.lineHeight,
    style.letterSpacing,
    style.getPropertyValue("--reading-block-spacing"),
    document.documentElement.className,
    ...paragraphs.flatMap(paragraph => {
      const paragraphStyle = window.getComputedStyle(paragraph)
      return [paragraphStyle.font, paragraphStyle.fontFamily, paragraphStyle.fontSize, paragraphStyle.fontWeight, paragraphStyle.lineHeight, paragraphStyle.letterSpacing]
    }),
  ].join("\u0000")
}

export function usePretextImageFlow(containerRef: RefObject<HTMLElement | null>, contentKey: string) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const figures = Array.from(container.querySelectorAll<HTMLElement>(":scope > figure[data-flow-image]"))
    const figure = figures[0]
    const image = figure?.querySelector<HTMLImageElement>(":scope > img")
    const sideValue = figure?.dataset.flowImage
    const side: FlowSide | null = sideValue === "left" || sideValue === "right" ? sideValue : null
    if (!figure || !image || !side || figures.length !== 1 || figure.querySelector("figcaption")) return
    const paragraphs = directFlowParagraphs(figure)
    if (!paragraphs.length || paragraphs.some(paragraph => !isSupportedParagraph(paragraph))) return
    const templates = paragraphs.map(element => ({ element, nodes: cloneNodes(Array.from(element.childNodes)) }))
    const abortController = new AbortController()
    let disposed = false
    let geometry: FlowImageAlphaGeometry | null = null
    let scheduledFrame = 0
    let lastSignature = ""
    const restore = () => {
      for (const template of templates) restoreParagraph(template)
      delete container.dataset.pretextFlowActive
      container.style.removeProperty("--pretext-flow-min-height")
      figure.style.removeProperty("--pretext-flow-image-top")
    }

    const render = (force = false) => {
      if (disposed || !geometry) {
        restore()
        return
      }
      const signature = styleSignature(container, figure, paragraphs)
      if (!force && signature === lastSignature) return
      lastSignature = signature
      restore()

      const containerWidth = container.clientWidth
      const containerRect = container.getBoundingClientRect()
      const authoredImageRect = image.getBoundingClientRect()
      const authoredImageWidth = authoredImageRect.width
      if (!containerWidth || !authoredImageWidth) return restore()
      const outerOffset = authoredImageWidth * geometry[side]
      figure.style.setProperty("--flow-image-outer-alpha-offset", `${outerOffset.toFixed(2)}px`)
      const authoredImageTop = authoredImageRect.top - containerRect.top
      const shapeMargin = parsePixelValue(window.getComputedStyle(figure).shapeMargin, 12)
      container.dataset.pretextFlowActive = "true"
      figure.style.setProperty("--pretext-flow-image-top", `${authoredImageTop.toFixed(2)}px`)

      // The active CSS can move the figure beyond the reading column to hide
      // transparent outer pixels. Measure the image again after that CSS has
      // taken effect so Pretext reserves the pixels where the image is
      // actually painted instead of relying on a duplicated position formula.
      const activeContainerRect = container.getBoundingClientRect()
      const activeImageRect = image.getBoundingClientRect()
      const imageTop = activeImageRect.top - activeContainerRect.top
      const imageLeft = activeImageRect.left - activeContainerRect.left
      const imageWidth = activeImageRect.width
      const imageHeight = activeImageRect.height || imageWidth * (geometry.height / geometry.width)
      if (!imageWidth || !imageHeight) return restore()
      for (const template of templates) {
        if (!layoutParagraph({
          paragraph: template.element,
          geometry,
          side,
          containerWidth,
          imageTop,
          imageHeight,
          imageLeft,
          imageWidth,
          shapeMargin,
        })) {
          restore()
          return
        }
      }
      container.style.setProperty("--pretext-flow-min-height", `${Math.ceil(imageTop + imageHeight)}px`)
    }

    const scheduleRender = (force = false) => {
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame)
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0
        render(force)
      })
    }
    const onFontsLoaded = () => scheduleRender(true)
    const onPreferencesChange = () => scheduleRender(true)
    const resizeObserver = new ResizeObserver(() => scheduleRender())
    resizeObserver.observe(container)
    resizeObserver.observe(figure)
    const themeObserver = new MutationObserver(() => scheduleRender(true))
    themeObserver.observe(document.documentElement, { attributeFilter: ["class"], attributes: true })
    document.fonts.addEventListener("loadingdone", onFontsLoaded)
    window.addEventListener("readingpreferenceschange", onPreferencesChange)
    void measureFlowImageAlpha(image.currentSrc || image.src, abortController.signal).then(measuredGeometry => {
      if (disposed || !measuredGeometry) return
      geometry = measuredGeometry
      scheduleRender(true)
    })
    return () => {
      disposed = true
      abortController.abort()
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      document.fonts.removeEventListener("loadingdone", onFontsLoaded)
      window.removeEventListener("readingpreferenceschange", onPreferencesChange)
      restore()
    }
  }, [containerRef, contentKey])
}
