"use client"

import { useRef, useState, type HTMLAttributes } from "react"
import { usePretextLineMetrics } from "./usePretextTextMetrics"

type Props = HTMLAttributes<HTMLParagraphElement> & {
  text: string
  maxLines?: number
  whiteSpace?: "normal" | "pre-wrap"
}

export function ExpandableText({
  text,
  maxLines = 3,
  whiteSpace = "normal",
  className,
  style,
  ...props
}: Props) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const { overflows } = usePretextLineMetrics(ref, text, { maxLines, whiteSpace })
  const collapsedStyle = expanded || !overflows
    ? undefined
    : {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: maxLines,
        overflow: "hidden",
      }

  return (
    <>
      <p
        {...props}
        ref={ref}
        className={className}
        style={{ ...style, ...collapsedStyle, whiteSpace }}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-[#A8A095]/80 dark:hover:text-[#f1f1f1]"
        >
          {expanded ? "menos" : "mais"}
        </button>
      )}
    </>
  )
}
