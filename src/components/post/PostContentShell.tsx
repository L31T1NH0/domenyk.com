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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeWheelDelta(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 18
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight
  return event.deltaY
}

function hasScrollableParent(target: EventTarget | null, deltaY: number) {
  if (!(target instanceof Element)) return false

  let element: Element | null = target
  while (element && element !== document.body && element !== document.documentElement) {
    const style = window.getComputedStyle(element)
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY)

    if (canScrollY && element.scrollHeight > element.clientHeight) {
      const scrollTop = element.scrollTop
      const maxScrollTop = element.scrollHeight - element.clientHeight
      if (deltaY < 0 && scrollTop > 0) return true
      if (deltaY > 0 && scrollTop < maxScrollTop - 1) return true
    }

    element = element.parentElement
  }

  return false
}

function syncBlurLayerBounds(content: HTMLElement, topLayer: HTMLElement, bottomLayer: HTMLElement) {
  const rect = content.getBoundingClientRect()
  const left = `${Math.max(0, rect.left)}px`
  const width = `${Math.max(0, rect.width)}px`

  topLayer.style.left = left
  topLayer.style.width = width
  bottomLayer.style.left = left
  bottomLayer.style.width = width
}

export function PostContentShell({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const topBlurRef = useRef<HTMLDivElement>(null)
  const bottomBlurRef = useRef<HTMLDivElement>(null)
  const fontSize = usePostContentFontSize(ref, { minSize: 12, maxSize: 18 })
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [visible, setVisible] = useState(false)
  const touchStartRef = useRef(0)
  const activeImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const threshold = 80

  const close = useCallback(() => {
    if (activeImageTimerRef.current) clearTimeout(activeImageTimerRef.current)
    setVisible(false)
    activeImageTimerRef.current = setTimeout(() => {
      setActiveImage(null)
      activeImageTimerRef.current = null
    }, 250)
  }, [])

  useEffect(() => {
    if (!activeImage) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setVisible(true))
    })

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
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      if (activeImageTimerRef.current) {
        clearTimeout(activeImageTimerRef.current)
        activeImageTimerRef.current = null
      }
    }
  }, [activeImage, close])

  useEffect(() => {
    if (activeImage) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const coarsePointer = window.matchMedia("(pointer: coarse)")
    if (reducedMotion.matches || coarsePointer.matches) return

    let targetY = window.scrollY
    let currentY = targetY
    let animationFrame: number | null = null

    const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

    const stopAnimation = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
    }

    const animate = () => {
      const distance = targetY - currentY
      currentY += distance * 0.18

      if (Math.abs(distance) < 0.5) {
        window.scrollTo(0, targetY)
        animationFrame = null
        currentY = targetY
        return
      }

      window.scrollTo(0, currentY)
      animationFrame = requestAnimationFrame(animate)
    }

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaY) < 1) return
      if (hasScrollableParent(event.target, event.deltaY)) return

      event.preventDefault()

      const delta = clamp(normalizeWheelDelta(event), -260, 260)
      if (animationFrame === null) {
        currentY = window.scrollY
        targetY = currentY
      }

      targetY = clamp(targetY + delta, 0, maxScrollY())
      if (animationFrame === null) animationFrame = requestAnimationFrame(animate)
    }

    const onScroll = () => {
      if (animationFrame !== null) return
      targetY = window.scrollY
      currentY = targetY
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      stopAnimation()
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("scroll", onScroll)
    }
  }, [activeImage])

  useEffect(() => {
    if (activeImage) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reducedMotion.matches) return

    const topLayer = topBlurRef.current
    const bottomLayer = bottomBlurRef.current
    const content = ref.current
    if (!topLayer || !bottomLayer || !content) return

    let lastY = window.scrollY
    let lastTime = performance.now()
    let targetBlur = 0
    let targetOpacity = 0
    let currentBlur = 0
    let currentOpacity = 0
    let animationFrame: number | null = null
    let boundsAnimationFrame: number | null = null

    const requestBoundsSync = () => {
      if (boundsAnimationFrame !== null) return
      boundsAnimationFrame = requestAnimationFrame(() => {
        syncBlurLayerBounds(content, topLayer, bottomLayer)
        boundsAnimationFrame = null
      })
    }

    const applyBlur = () => {
      const blur = currentBlur.toFixed(2)
      const opacity = currentOpacity.toFixed(3)
      const blurValue = `blur(${blur}px)`

      topLayer.style.opacity = opacity
      topLayer.style.backdropFilter = blurValue
      topLayer.style.setProperty("-webkit-backdrop-filter", blurValue)
      bottomLayer.style.opacity = opacity
      bottomLayer.style.backdropFilter = blurValue
      bottomLayer.style.setProperty("-webkit-backdrop-filter", blurValue)
    }

    const animate = () => {
      targetBlur *= 0.84
      targetOpacity *= 0.82
      currentBlur += (targetBlur - currentBlur) * 0.22
      currentOpacity += (targetOpacity - currentOpacity) * 0.2

      if (currentBlur < 0.04 && currentOpacity < 0.01 && targetBlur < 0.04 && targetOpacity < 0.01) {
        currentBlur = 0
        currentOpacity = 0
        targetBlur = 0
        targetOpacity = 0
        applyBlur()
        animationFrame = null
        return
      }

      applyBlur()
      animationFrame = requestAnimationFrame(animate)
    }

    const requestAnimation = () => {
      if (animationFrame === null) animationFrame = requestAnimationFrame(animate)
    }

    const onScroll = () => {
      const currentY = window.scrollY
      const currentTime = performance.now()
      const elapsed = Math.max(currentTime - lastTime, 16)
      const velocity = Math.abs((currentY - lastY) / elapsed)

      targetBlur = Math.max(targetBlur, clamp(velocity * 24, 0, 14))
      targetOpacity = Math.max(targetOpacity, clamp(velocity * 1.8, 0, 0.7))
      lastY = currentY
      lastTime = currentTime
      requestBoundsSync()
      requestAnimation()
    }

    syncBlurLayerBounds(content, topLayer, bottomLayer)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", requestBoundsSync, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", requestBoundsSync)
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      if (boundsAnimationFrame !== null) cancelAnimationFrame(boundsAnimationFrame)
      topLayer.style.opacity = "0"
      topLayer.style.backdropFilter = "blur(0px)"
      topLayer.style.setProperty("-webkit-backdrop-filter", "blur(0px)")
      bottomLayer.style.opacity = "0"
      bottomLayer.style.backdropFilter = "blur(0px)"
      bottomLayer.style.setProperty("-webkit-backdrop-filter", "blur(0px)")
    }
  }, [activeImage])

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const image = (event.target as HTMLElement).closest("img")
    if (image && ref.current?.contains(image)) {
      if (image.closest('[data-role="author-reference"]')) return
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

    const targetUrl = new URL(href, window.location.href)
    const isSamePage =
      targetUrl.origin === window.location.origin &&
      targetUrl.pathname === window.location.pathname &&
      targetUrl.search === window.location.search
    const targetId = decodeURIComponent(targetUrl.hash.slice(1))
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
      {!activeImage && (
        <>
          <div
            ref={topBlurRef}
            aria-hidden
            className="pointer-events-none fixed top-0 z-30 h-[18vh] max-h-36 min-h-20 opacity-0"
            style={{
              background: "linear-gradient(to bottom, rgba(4,4,4,0.12), rgba(4,4,4,0))",
              maskImage: "linear-gradient(to bottom, black 0%, black 18%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 18%, transparent 100%)",
              willChange: "opacity, backdrop-filter",
            }}
          />
          <div
            ref={bottomBlurRef}
            aria-hidden
            className="pointer-events-none fixed bottom-0 z-30 h-[18vh] max-h-36 min-h-20 opacity-0"
            style={{
              background: "linear-gradient(to top, rgba(4,4,4,0.12), rgba(4,4,4,0))",
              maskImage: "linear-gradient(to top, black 0%, black 18%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, black 0%, black 18%, transparent 100%)",
              willChange: "opacity, backdrop-filter",
            }}
          />
        </>
      )}

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
