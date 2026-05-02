"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { prepare, layout } from "@chenglou/pretext"

type Options = {
  minSize?: number
  maxSize?: number
  maxLinesPerParagraph?: number
}

type PreparedParagraph = {
  text: string
  lineHeightRatio: number
  getPrepared: (fontSize: number) => ReturnType<typeof prepare>
}

function getLineHeightRatio(style: CSSStyleDeclaration, fallbackFontSize: number) {
  const lineHeight = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(lineHeight) && fallbackFontSize > 0) return lineHeight / fallbackFontSize
  return 1.625
}

function buildFont(style: CSSStyleDeclaration, fontSize: number) {
  return `${style.fontStyle || "normal"} ${style.fontVariant || "normal"} ${style.fontWeight || "400"} ${style.fontStretch || "normal"} ${fontSize}px ${style.fontFamily || "sans-serif"}`
}

export function usePostContentFontSize(
  containerRef: RefObject<HTMLElement | null>,
  options: Options = {}
): number {
  const { minSize = 12, maxSize = 18, maxLinesPerParagraph = 6 } = options
  const [fontSize, setFontSize] = useState(maxSize)
  const cache = useRef<Map<string, ReturnType<typeof prepare>>>(new Map())

  useEffect(() => {
    let cancelled = false

    const measure = () => {
      const container = containerRef.current
      const width = container?.clientWidth ?? 0
      if (!container || !width || cancelled) return

      const paragraphs: PreparedParagraph[] = Array.from(
        container.querySelectorAll<HTMLParagraphElement>("p")
      )
        .map((el) => {
          const text = el.textContent?.replace(/\s+/g, " ").trim() ?? ""
          if (!text) return null
          const style = window.getComputedStyle(el)
          const baseFontSize = Number.parseFloat(style.fontSize) || maxSize
          return {
            text,
            lineHeightRatio: getLineHeightRatio(style, baseFontSize),
            getPrepared(size: number) {
              const font = buildFont(style, size)
              const key = `${font}__${text}`
              if (!cache.current.has(key)) cache.current.set(key, prepare(text, font))
              return cache.current.get(key)!
            },
          }
        })
        .filter((p): p is PreparedParagraph => p !== null)

      if (!paragraphs.length) return

      let lo = minSize, hi = maxSize, optimal = minSize
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const totalLines = paragraphs.reduce((sum, p) => {
          const { lineCount } = layout(p.getPrepared(mid), width, mid * p.lineHeightRatio)
          return sum + lineCount
        }, 0)
        if (totalLines / paragraphs.length <= maxLinesPerParagraph) {
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

    const ro = new ResizeObserver(measure)
    ro.observe(container)
    const mo = new MutationObserver(measure)
    mo.observe(container, { childList: true, subtree: true, characterData: true })

    return () => {
      cancelled = true
      ro.disconnect()
      mo.disconnect()
    }
  }, [containerRef, minSize, maxSize, maxLinesPerParagraph])

  return fontSize
}
