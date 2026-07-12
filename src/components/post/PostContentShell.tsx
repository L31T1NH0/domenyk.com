"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react"
import { XMarkIcon } from "@heroicons/react/24/solid"
import { usePostContentFontSize } from "./usePostContentFontSize"

type Props = {
  html: string
  className?: string
  variant?: "default" | "editorial"
}

type ActiveImage = {
  src: string
  alt: string
}

export function PostContentShell({ html, className, variant = "default" }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fontSize = usePostContentFontSize(
    ref,
    variant === "editorial"
      ? { minSize: 16, maxSize: 18, maxLinesPerParagraph: 9 }
      : { minSize: 12, maxSize: 16 }
  )
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [visible, setVisible] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef(0)
  const activeImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const threshold = 80

  const close = useCallback(() => {
    if (activeImageTimerRef.current) clearTimeout(activeImageTimerRef.current)
    setVisible(false)
    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250
    activeImageTimerRef.current = setTimeout(() => {
      if (dialogRef.current?.open) dialogRef.current.close()
      setActiveImage(null)
      openerRef.current?.focus()
      openerRef.current = null
      activeImageTimerRef.current = null
    }, closeDelay)
  }, [])

  useEffect(() => {
    const content = ref.current
    if (!content) return

    const images = Array.from(content.querySelectorAll("img"))
      .filter((image) => !image.closest('[data-role="author-reference"]'))

    for (const image of images) {
      image.tabIndex = 0
      image.setAttribute("role", "button")
      image.setAttribute("aria-label", image.alt ? `Ampliar imagem: ${image.alt}` : "Ampliar imagem")
    }

    return () => {
      for (const image of images) {
        image.removeAttribute("tabindex")
        image.removeAttribute("role")
        image.removeAttribute("aria-label")
      }
    }
  }, [html])

  useEffect(() => {
    if (!activeImage) return
    const dialog = dialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setVisible(true)
        closeButtonRef.current?.focus()
      })
    })

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

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

    dialog.addEventListener("wheel", onWheel, { passive: true })
    dialog.addEventListener("touchstart", onTouchStart, { passive: true })
    dialog.addEventListener("touchmove", onTouchMove, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      dialog.removeEventListener("wheel", onWheel)
      dialog.removeEventListener("touchstart", onTouchStart)
      dialog.removeEventListener("touchmove", onTouchMove)
      if (activeImageTimerRef.current) {
        clearTimeout(activeImageTimerRef.current)
        activeImageTimerRef.current = null
      }
      if (dialog.open) dialog.close()
    }
  }, [activeImage, close])

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const image = (event.target as HTMLElement).closest("img")
    if (image && ref.current?.contains(image)) {
      if (image.closest('[data-role="author-reference"]')) return
      openerRef.current = image
      setActiveImage({
        src: image.getAttribute("src") ?? "",
        alt: image.getAttribute("alt") ?? "",
      })
      return
    }

    const anchor = (event.target as HTMLElement).closest("a")
    if (!anchor || !ref.current?.contains(anchor)) return

    const href = anchor.getAttribute("href")
    if (!href?.includes("#")) return

    let targetUrl: URL
    try {
      targetUrl = new URL(href, window.location.href)
    } catch {
      return
    }
    const isSamePage =
      targetUrl.origin === window.location.origin &&
      targetUrl.pathname === window.location.pathname &&
      targetUrl.search === window.location.search
    let targetId = ""
    try {
      targetId = decodeURIComponent(targetUrl.hash.slice(1))
    } catch {
      return
    }
    const target = isSamePage && targetId ? document.getElementById(targetId) : null

    if (!target) return

    event.preventDefault()
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    })
    window.history.pushState(null, "", targetUrl.hash)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return
    const image = (event.target as HTMLElement).closest("img")
    if (!image || !ref.current?.contains(image)) return
    if (image.closest('[data-role="author-reference"]')) return

    const src = image.getAttribute("src") ?? ""
    if (!src) return

    event.preventDefault()
    openerRef.current = image
    setActiveImage({ src, alt: image.getAttribute("alt") ?? "" })
  }

  return (
    <>
      <div
        ref={ref}
        data-post-content
        className={["post-content flex flex-col gap-3.5", className].filter(Boolean).join(" ")}
        style={{ fontSize }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {activeImage && (
        <dialog
          ref={dialogRef}
          aria-label={activeImage.alt ? `Imagem ampliada: ${activeImage.alt}` : "Imagem ampliada"}
          onCancel={(event) => {
            event.preventDefault()
            close()
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
          className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-4 backdrop:bg-transparent motion-reduce:!transition-none"
          style={{
            backgroundColor: `rgba(0,0,0,${visible ? 0.92 : 0})`,
            backdropFilter: `blur(${visible ? 8 : 0}px)`,
            transition: "background-color 250ms ease, backdrop-filter 250ms ease",
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Fechar imagem ampliada"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:!transition-none"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 250ms ease" }}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
          <img
            src={activeImage.src}
            alt={activeImage.alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl motion-reduce:!transform-none motion-reduce:!transition-none"
            style={{
              filter: "grayscale(0)",
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.92)",
              transition: "opacity 250ms ease, transform 250ms ease",
            }}
          />
          <span
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white motion-reduce:!transition-none"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 400ms ease" }}
          >
            Role, deslize ou pressione Esc para fechar
          </span>
        </dialog>
      )}
    </>
  )
}
