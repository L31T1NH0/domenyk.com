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

export function BackHome({ boundaryId = "post-content-boundary", label = "Voltar", href = "/", variant = "default" }: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [top, setTop] = useState("50%")

  useEffect(() => {
    let frame = 0

    function measure() {
      frame = 0
      const boundary = document.getElementById(boundaryId)
      const link = linkRef.current
      if (!boundary || !link) {
        setTop("50%")
        return
      }

      const viewportCenter = window.innerHeight / 2
      const buttonHeight = link.getBoundingClientRect().height
      const buttonTop = viewportCenter - buttonHeight / 2
      const buttonBottom = viewportCenter + buttonHeight / 2
      const boundaryTop = boundary.getBoundingClientRect().top
      const gap = 12

      if (boundaryTop >= buttonTop - gap && boundaryTop <= buttonBottom) {
        setTop(`${boundaryTop + gap + buttonHeight / 2}px`)
        return
      }

      setTop("50%")
    }

    function scheduleMeasure() {
      if (frame) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener("scroll", scheduleMeasure, { passive: true })
    window.addEventListener("resize", scheduleMeasure)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleMeasure)
      window.removeEventListener("resize", scheduleMeasure)
    }
  }, [boundaryId])

  return (
    <>
      <div className="md:hidden mt-4 mx-0">
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
        className={[
          "hidden md:flex fixed left-[calc(50%-18rem)] -translate-x-full -translate-y-1/2 -ml-4 z-40 items-center justify-center p-1.5 rounded-full text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-[top,transform] duration-150 hover:scale-110",
          variant === "editorial" ? "editorial-back-home" : "",
        ].join(" ")}
        style={{ top }}
        aria-label={label}
        title={label}
      >
        <ChevronLeftIcon className="size-7 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
      </Link>
    </>
  )
}
