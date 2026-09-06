"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon } from "@heroicons/react/24/outline"

type Props = {
  boundaryId?: string
  label?: string
  href?: string
  variant?: "default" | "editorial"
}

export function BackHome({ boundaryId = "post-content-boundary", label = "Voltar", href = "/" }: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    let frame = 0

    function measure() {
      frame = 0
      const boundary = document.getElementById(boundaryId)
      const link = linkRef.current
      const content = link?.closest<HTMLElement>(".post-reading-page, .post-style-editorial")
        ?? boundary?.parentElement
      if (!content || !link) return

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const buttonWidth = link.getBoundingClientRect().width
      const left = content.getBoundingClientRect().left - buttonWidth - 2.5 * rem
      if (!window.matchMedia("(min-width: 48rem)").matches || left < 0.5 * rem) {
        setPosition(null)
        return
      }

      const viewportCenter = window.innerHeight / 2
      const buttonHeight = link.getBoundingClientRect().height
      const buttonTop = viewportCenter - buttonHeight / 2
      const buttonBottom = viewportCenter + buttonHeight / 2
      const boundaryTop = boundary?.getBoundingClientRect().top ?? Infinity
      const gap = 12
      const top = boundaryTop >= buttonTop - gap && boundaryTop <= buttonBottom
        ? boundaryTop + gap + buttonHeight / 2
        : viewportCenter
      setPosition((current) => current?.left === left && current.top === top ? current : { left, top })
    }

    function scheduleMeasure() {
      if (frame) return
      frame = window.requestAnimationFrame(measure)
    }

    scheduleMeasure()
    window.addEventListener("scroll", scheduleMeasure, { passive: true })
    window.addEventListener("resize", scheduleMeasure)
    const observer = new ResizeObserver(scheduleMeasure)
    const link = linkRef.current
    const content = link?.closest<HTMLElement>(".post-reading-page, .post-style-editorial")
      ?? document.getElementById(boundaryId)?.parentElement
    if (content) observer.observe(content)
    if (link) observer.observe(link)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleMeasure)
      window.removeEventListener("resize", scheduleMeasure)
      observer.disconnect()
    }
  }, [boundaryId])

  return (
    <>
      <div className={position ? "hidden" : "mt-4 mx-0"}>
        <Link
          href={href}
          className="inline-flex w-fit h-fit items-center gap-2 py-1 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:text-zinc-100 mx-0"
          aria-label={label}
          title={label}
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
          <span className="text-sm">{label}</span>
        </Link>
      </div>

      <Link
        ref={linkRef}
        href={href}
        className="fixed z-40 flex size-10 items-center justify-center rounded-full text-zinc-700 transition-[top] duration-150 hover:text-zinc-900 motion-reduce:transition-none dark:text-zinc-300 dark:hover:text-zinc-100"
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          transform: "translateY(-50%)",
          visibility: position ? "visible" : "hidden",
        }}
        aria-hidden={!position}
        tabIndex={position ? undefined : -1}
        aria-label={label}
        title={label}
      >
        <ChevronLeftIcon className="size-7" aria-hidden="true" />
      </Link>
    </>
  )
}
