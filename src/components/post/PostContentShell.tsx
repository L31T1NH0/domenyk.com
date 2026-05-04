"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { XMarkIcon } from "@heroicons/react/24/solid"
import { usePostContentFontSize } from "./usePostContentFontSize"

type Props = {
  html: string
  className?: string
}

type ActiveImage = {
  src: string
  alt: string
}

export function PostContentShell({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fontSize = usePostContentFontSize(ref, { minSize: 12, maxSize: 18 })
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [visible, setVisible] = useState(false)
  const touchStartRef = useRef(0)
  const threshold = 80

  const close = useCallback(() => {
    setVisible(false)
    window.setTimeout(() => setActiveImage(null), 250)
  }, [])

  useEffect(() => {
    if (!activeImage) return
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > threshold) close()
    }
    const onTouchStart = (event: TouchEvent) => {
      touchStartRef.current = event.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (event: TouchEvent) => {
      const delta = Math.abs((event.touches[0]?.clientY ?? 0) - touchStartRef.current)
      if (delta > threshold) close()
    }

    document.addEventListener("keydown", onKey)
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }, [activeImage, close])

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const image = (event.target as HTMLElement).closest("img")
    if (!image || !ref.current?.contains(image)) return
    setActiveImage({
      src: image.getAttribute("src") ?? "",
      alt: image.getAttribute("alt") ?? "",
    })
  }

  return (
    <>
      <div
        ref={ref}
        data-post-content
        className={["post-content flex flex-col gap-4", className].filter(Boolean).join(" ")}
        style={{ fontSize }}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {activeImage && (
        <div
          onClick={close}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            backgroundColor: `rgba(0,0,0,${visible ? 0.92 : 0})`,
            backdropFilter: `blur(${visible ? 8 : 0}px)`,
            transition: "background-color 250ms ease, backdrop-filter 250ms ease",
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 250ms ease" }}
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
          <img
            src={activeImage.src}
            alt={activeImage.alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            style={{
              filter: "grayscale(0)",
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.92)",
              transition: "opacity 250ms ease, transform 250ms ease",
            }}
          />
          <span
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white mix-blend-difference backdrop-blur-sm"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 400ms ease" }}
          >
            Scroll ou Esc para fechar
          </span>
        </div>
      )}
    </>
  )
}
