"use client"

import { useMemo, useRef } from "react"
import { usePretextImageFlow } from "@/components/post/usePretextImageFlow"

type Props = {
  className?: string
  html: string
  surface: "detail" | "timeline"
}

export function NoteContentShell({ className, html, surface }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const contentMarkup = useMemo(() => ({ __html: html }), [html])

  usePretextImageFlow(ref, html)

  return (
    <div
      ref={ref}
      data-note-reading-surface={surface}
      className={["note-content", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={contentMarkup}
    />
  )
}
