"use client"

import { useRef } from "react"
import { usePostContentFontSize } from "./usePostContentFontSize"

type Props = {
  children: React.ReactNode
}

export function PostContentWrapper({ children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fontSize = usePostContentFontSize(ref)

  return (
    <div ref={ref} style={{ fontSize }} className="prose prose-invert max-w-none">
      {children}
    </div>
  )
}
