"use client"

import { useRef, type HTMLAttributes, type Ref } from "react"
import { usePretextTextFit } from "./usePretextTextMetrics"

type TextTag = "span" | "p" | "h1" | "h2" | "h3"

type Props = HTMLAttributes<HTMLElement> & {
  as?: TextTag
  text: string
  minSize?: number
  maxSize?: number
  maxLines?: number
}

export function AutoFitText({
  as = "span",
  text,
  minSize = 12,
  maxSize = 18,
  maxLines = 2,
  style,
  ...props
}: Props) {
  const ref = useRef<HTMLElement>(null)
  const fontSize = usePretextTextFit(ref, text, { minSize, maxSize, maxLines })

  const nextStyle = { ...style, fontSize }

  if (as === "p") return <p {...props} ref={ref as Ref<HTMLParagraphElement>} style={nextStyle}>{text}</p>
  if (as === "h1") return <h1 {...props} ref={ref as Ref<HTMLHeadingElement>} style={nextStyle}>{text}</h1>
  if (as === "h2") return <h2 {...props} ref={ref as Ref<HTMLHeadingElement>} style={nextStyle}>{text}</h2>
  if (as === "h3") return <h3 {...props} ref={ref as Ref<HTMLHeadingElement>} style={nextStyle}>{text}</h3>
  return <span {...props} ref={ref as Ref<HTMLSpanElement>} style={nextStyle}>{text}</span>
}
