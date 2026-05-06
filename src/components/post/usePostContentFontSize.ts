"use client"

import type { RefObject } from "react"
import { usePretextContentFontSize } from "@/components/text/usePretextTextMetrics"

type Options = {
  minSize?: number
  maxSize?: number
  maxLinesPerParagraph?: number
}

export function usePostContentFontSize(
  containerRef: RefObject<HTMLElement | null>,
  options: Options = {}
): number {
  const { minSize = 12, maxSize = 18, maxLinesPerParagraph = 6 } = options

  return usePretextContentFontSize(containerRef, {
    minSize,
    maxSize,
    maxLinesPerBlock: maxLinesPerParagraph,
    blockSelector: "p",
  })
}
