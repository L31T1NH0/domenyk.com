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
import {
  lineSlotForAlphaBand,
  stabilizePaintedLine,
  type FlowSide,
} from "./flow-image-layout"

type InlineSource = {
  node: Text
  text: string
}

type ParagraphTemplate = {
  element: HTMLParagraphElement
  nodes: Node[]
}

type PositionedFragment = {
  gapBefore: number
  left: number
  lineIndex: number
  text: string
  top: number
}

const MIN_LINE_WIDTH = 24
const LINE_WIDTH_GUARD = 4
const MAX_GENERATED_LINES = 2_000
const SUPPORTED_INLINE_TAGS = new Set([
  "A",
  "B",
  "CODE",
  "DEL",
  "EM",
  "I",
  "KBD",
  "MARK",
  "S",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
])

function parsePixelValue(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function canvasFont(style: CSSStyleDeclaration) {
  const variant = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal"
  return [
    style.fontStyle || "normal",
    variant,
    style.fontWeight || "400",
    style.fontSize || "16px",
    style.fontFamily || "sans-serif",
  ].join(" ")
}

function isSupportedParagraph(paragraph: HTMLParagraphElement) {
  return Array.from(paragraph.querySelectorAll("*")).every((element) => (
    SUPPORTED_INLINE_TAGS.has(element.tagName)
  ))
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
  return nodes.map((node) => node.cloneNode(true))
}

function restoreParagraph(template: ParagraphTemplate) {
  template.element.replaceChildren(...cloneNodes(template.nodes))
  template.element.removeAttribute("data-pretext-flow-rendered")
  template.element.style.removeProperty("height")
}

function collectInlineSources(paragraph: HTMLParagraphElement): {
  items: RichInlineItem[]
  sources: InlineSource[]
} | null {
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

  return items.length > 0 ? { items, sources } : null
}

function preservedWhitespace(text: string, edge: "start" | "end") {
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
    const fragments = positioned[itemIndex] ?? []
    const leading = preservedWhitespace(source.text, "start")
    const trailing = preservedWhitespace(source.text, "end")

    if (source.text.trim().length === 0) {
      const space = document.createElement("span")
      space.className = "pretext-flow-preserved-space"
      space.textContent = source.text
      replacement.appendChild(space)
      source.node.replaceWith(replacement)
      continue
    }

    if (leading) {
      const space = document.createElement("span")
      space.className = "pretext-flow-preserved-space"
      space.textContent = leading
      replacement.appendChild(space)
    }
    for (const fragment of fragments) {
      const span = document.createElement("span")
      span.className = "pretext-flow-fragment"
      span.dataset.pretextGapBefore = fragment.gapBefore.toFixed(2)
      span.dataset.pretextLine = String(fragment.lineIndex)
      span.style.setProperty("--pretext-fragment-left", `${fragment.left.toFixed(2)}px`)
      span.style.setProperty("--pretext-fragment-top", `${fragment.top.toFixed(2)}px`)
      span.textContent = fragment.text
      replacement.appendChild(span)
    }
    if (trailing) {
      const space = document.createElement("span")
      space.className = "pretext-flow-preserved-space"
      space.textContent = trailing
      replacement.appendChild(space)
    }
    source.node.replaceWith(replacement)
  }

  const rendered = Array.from(paragraph.querySelectorAll<HTMLElement>(".pretext-flow-fragment"))
  const lines = new Map<number, HTMLElement[]>()
  for (const fragment of rendered) {
    const lineIndex = Number.parseInt(fragment.dataset.pretextLine ?? "", 10)
    if (!Number.isFinite(lineIndex)) continue
    const line = lines.get(lineIndex) ?? []
    line.push(fragment)
    lines.set(lineIndex, line)
  }
  for (const line of lines.values()) {
    line.sort((a, b) => (
      parsePixelValue(a.style.getPropertyValue("--pretext-fragment-left"))
      - parsePixelValue(b.style.getPropertyValue("--pretext-fragment-left"))
    ))
    const correctedLefts = stabilizePaintedLine(line.map((fragment) => ({
      gapBefore: parsePixelValue(fragment.dataset.pretextGapBefore ?? "0"),
      left: parsePixelValue(fragment.style.getPropertyValue("--pretext-fragment-left")),
      width: fragment.getBoundingClientRect().width,
    })))
    line.forEach((fragment, index) => {
      const correctedLeft = correctedLefts[index]
      if (correctedLeft !== undefined) {
        fragment.style.setProperty("--pretext-fragment-left", `${correctedLeft.toFixed(2)}px`)
      }
    })
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
  const paragraphStyle = window.getComputedStyle(paragraph)
  const fontSize = parsePixelValue(paragraphStyle.fontSize, 16)
  const lineHeight = parsePixelValue(paragraphStyle.lineHeight, fontSize * 1.5)
  const positioned: PositionedFragment[][] = source.sources.map(() => [])
  let cursor: RichInlineCursor = { itemIndex: 0, segmentIndex: 0, graphemeIndex: 0 }
  let lineIndex = 0

  while (lineIndex < MAX_GENERATED_LINES) {
    const bandTop = paragraphTop + lineIndex * lineHeight
    const slot = lineSlotForAlphaBand({
      geometry,
      side,
      containerWidth,
      bandTop,
      bandBottom: bandTop + lineHeight,
      imageTop,
      imageHeight,
      imageLeft,
      imageWidth,
      shapeMargin,
    })
    if (slot.width < MIN_LINE_WIDTH) {
      lineIndex += 1
      continue
    }

    const range = layoutNextRichInlineLineRange(
      prepared,
      Math.max(1, slot.width - LINE_WIDTH_GUARD),
      cursor
    )
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

function styleSignature(
  container: HTMLElement,
  figure: HTMLElement,
  paragraphs: HTMLParagraphElement[]
) {
  const containerStyle = window.getComputedStyle(container)
  return [
    container.clientWidth,
    figure.getBoundingClientRect().width,
    containerStyle.fontSize,
    containerStyle.lineHeight,
    containerStyle.letterSpacing,
    containerStyle.getPropertyValue("--reading-block-spacing"),
    document.documentElement.className,
    ...paragraphs.flatMap((paragraph) => {
      const style = window.getComputedStyle(paragraph)
      return [style.font, style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing]
    }),
  ].join("\u0000")
}

export function usePretextImageFlow(
  containerRef: RefObject<HTMLElement | null>,
  contentKey: string
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const figures = Array.from(container.querySelectorAll<HTMLElement>(":scope > figure[data-flow-image]"))
    const figure = figures[0]
    const image = figure?.querySelector<HTMLImageElement>(":scope > img")
    const sideValue = figure?.dataset.flowImage
    const side: FlowSide | null = sideValue === "left" || sideValue === "right" ? sideValue : null
    if (!figure || !image || !side || figures.length !== 1) return

    const paragraphs = directFlowParagraphs(figure)
    if (paragraphs.length === 0 || paragraphs.some((paragraph) => !isSupportedParagraph(paragraph))) return
    const templates: ParagraphTemplate[] = paragraphs.map((element) => ({
      element,
      nodes: cloneNodes(Array.from(element.childNodes)),
    }))
    const abortController = new AbortController()
    let disposed = false
    let geometry: FlowImageAlphaGeometry | null = null
    let lastSignature = ""
    let scheduledFrame = 0

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

      // Measure the authored CSS size before activating the absolute Pretext
      // layer. This keeps the geometry aligned across desktop and mobile
      // breakpoints without duplicating CSS width rules in JavaScript.
      restore()

      const containerWidth = container.clientWidth
      const imageWidth = figure.getBoundingClientRect().width
      const imageHeight = imageWidth * (geometry.height / geometry.width)
      if (!containerWidth || !imageWidth || !imageHeight) {
        restore()
        return
      }

      const outerOffset = imageWidth * geometry[side]
      figure.style.setProperty("--flow-image-outer-alpha-offset", `${outerOffset.toFixed(2)}px`)
      const imageTop = figure.getBoundingClientRect().top - container.getBoundingClientRect().top
      const imageLeft = side === "left"
        ? -outerOffset
        : containerWidth + outerOffset - imageWidth
      const shapeMargin = parsePixelValue(window.getComputedStyle(figure).shapeMargin, 12)
      container.dataset.pretextFlowActive = "true"
      figure.style.setProperty("--pretext-flow-image-top", `${imageTop.toFixed(2)}px`)

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

    const source = image.currentSrc || image.src
    void measureFlowImageAlpha(source, abortController.signal).then((measuredGeometry) => {
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
