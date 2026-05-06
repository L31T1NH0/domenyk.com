"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { layout, prepare } from "@chenglou/pretext"

type WhiteSpace = "normal" | "pre-wrap"

type TextFitOptions = {
  minSize?: number
  maxSize?: number
  maxLines?: number
  whiteSpace?: WhiteSpace
}

type ContentFitOptions = {
  minSize?: number
  maxSize?: number
  maxLinesPerBlock?: number
  blockSelector?: string
  whiteSpace?: WhiteSpace
}

type TextLineOptions = {
  maxLines?: number
  whiteSpace?: WhiteSpace
}

type PreparedBlock = {
  text: string
  lineHeightRatio: number
  getPrepared: (fontSize: number) => ReturnType<typeof prepare>
}

function getLineHeightRatio(style: CSSStyleDeclaration, fallbackFontSize: number) {
  const lineHeight = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(lineHeight) && fallbackFontSize > 0) return lineHeight / fallbackFontSize
  return 1.5
}

function getLetterSpacing(style: CSSStyleDeclaration) {
  const letterSpacing = Number.parseFloat(style.letterSpacing)
  return Number.isFinite(letterSpacing) ? letterSpacing : undefined
}

function buildFont(style: CSSStyleDeclaration, fontSize: number) {
  return `${style.fontStyle || "normal"} ${style.fontVariant || "normal"} ${style.fontWeight || "400"} ${style.fontStretch || "normal"} ${fontSize}px ${style.fontFamily || "sans-serif"}`
}

function normalizeText(text: string, whiteSpace: WhiteSpace) {
  return whiteSpace === "pre-wrap" ? text.replace(/\r\n?/g, "\n").trim() : text.replace(/\s+/g, " ").trim()
}

export function usePretextTextFit(
  ref: RefObject<HTMLElement | null>,
  text: string,
  options: TextFitOptions = {}
) {
  const { minSize = 12, maxSize = 18, maxLines = 2, whiteSpace = "normal" } = options
  const [fontSize, setFontSize] = useState(maxSize)
  const cache = useRef<Map<string, ReturnType<typeof prepare>>>(new Map())

  useEffect(() => {
    let cancelled = false

    const measure = () => {
      const element = ref.current
      const width = element?.clientWidth ?? 0
      const normalizedText = normalizeText(text, whiteSpace)
      if (!element || !width || !normalizedText || cancelled) return

      const style = window.getComputedStyle(element)
      const baseFontSize = Number.parseFloat(style.fontSize) || maxSize
      const lineHeightRatio = getLineHeightRatio(style, baseFontSize)
      const letterSpacing = getLetterSpacing(style)

      const getPrepared = (size: number) => {
        const font = buildFont(style, size)
        const key = `${font}__${whiteSpace}__${letterSpacing ?? ""}__${normalizedText}`
        if (!cache.current.has(key)) {
          cache.current.set(key, prepare(normalizedText, font, { whiteSpace, letterSpacing }))
        }
        return cache.current.get(key)!
      }

      let lo = minSize
      let hi = maxSize
      let optimal = minSize
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const { lineCount } = layout(getPrepared(mid), width, mid * lineHeightRatio)
        if (lineCount <= maxLines) {
          optimal = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      if (!cancelled) setFontSize(optimal)
    }

    document.fonts.ready.then(measure)
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [ref, text, minSize, maxSize, maxLines, whiteSpace])

  return fontSize
}

export function usePretextLineMetrics(
  ref: RefObject<HTMLElement | null>,
  text: string,
  options: TextLineOptions = {}
) {
  const { maxLines = 3, whiteSpace = "normal" } = options
  const [lineCount, setLineCount] = useState(0)
  const cache = useRef<Map<string, ReturnType<typeof prepare>>>(new Map())

  useEffect(() => {
    let cancelled = false

    const measure = () => {
      const element = ref.current
      const width = element?.clientWidth ?? 0
      const normalizedText = normalizeText(text, whiteSpace)
      if (!element || !width || !normalizedText || cancelled) {
        if (!cancelled) setLineCount(0)
        return
      }

      const style = window.getComputedStyle(element)
      const fontSize = Number.parseFloat(style.fontSize) || 14
      const lineHeightRatio = getLineHeightRatio(style, fontSize)
      const font = buildFont(style, fontSize)
      const letterSpacing = getLetterSpacing(style)
      const key = `${font}__${whiteSpace}__${letterSpacing ?? ""}__${normalizedText}`
      if (!cache.current.has(key)) {
        cache.current.set(key, prepare(normalizedText, font, { whiteSpace, letterSpacing }))
      }

      const next = layout(cache.current.get(key)!, width, fontSize * lineHeightRatio).lineCount
      if (!cancelled) setLineCount(next)
    }

    document.fonts.ready.then(measure)
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [ref, text, maxLines, whiteSpace])

  return { lineCount, overflows: lineCount > maxLines }
}

export function usePretextContentFontSize(
  containerRef: RefObject<HTMLElement | null>,
  options: ContentFitOptions = {}
) {
  const {
    minSize = 12,
    maxSize = 18,
    maxLinesPerBlock = 6,
    blockSelector = "p",
    whiteSpace = "normal",
  } = options
  const [fontSize, setFontSize] = useState(maxSize)
  const cache = useRef<Map<string, ReturnType<typeof prepare>>>(new Map())

  useEffect(() => {
    let cancelled = false

    const measure = () => {
      const container = containerRef.current
      const width = container?.clientWidth ?? 0
      if (!container || !width || cancelled) return

      const blocks: PreparedBlock[] = Array.from(container.querySelectorAll<HTMLElement>(blockSelector))
        .map((el) => {
          const text = normalizeText(el.textContent ?? "", whiteSpace)
          if (!text) return null
          const style = window.getComputedStyle(el)
          const baseFontSize = Number.parseFloat(style.fontSize) || maxSize
          const letterSpacing = getLetterSpacing(style)
          return {
            text,
            lineHeightRatio: getLineHeightRatio(style, baseFontSize),
            getPrepared(size: number) {
              const font = buildFont(style, size)
              const key = `${font}__${whiteSpace}__${letterSpacing ?? ""}__${text}`
              if (!cache.current.has(key)) {
                cache.current.set(key, prepare(text, font, { whiteSpace, letterSpacing }))
              }
              return cache.current.get(key)!
            },
          }
        })
        .filter((block): block is PreparedBlock => block !== null)

      if (!blocks.length) return

      let lo = minSize
      let hi = maxSize
      let optimal = minSize
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const totalLines = blocks.reduce((sum, block) => {
          const { lineCount } = layout(block.getPrepared(mid), width, mid * block.lineHeightRatio)
          return sum + lineCount
        }, 0)
        if (totalLines / blocks.length <= maxLinesPerBlock) {
          optimal = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      if (!cancelled) setFontSize(optimal)
    }

    document.fonts.ready.then(measure)
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(container, { childList: true, subtree: true, characterData: true })

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [containerRef, minSize, maxSize, maxLinesPerBlock, blockSelector, whiteSpace])

  return fontSize
}
