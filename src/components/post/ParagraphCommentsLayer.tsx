"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"
import { ParagraphThread } from "./ParagraphThread"
import type { PostLocale } from "@/lib/post-locales"

type ParagraphPosition = {
  pid: string
  top: number
  left: number
}

type Props = {
  postId: string
  isAdmin?: boolean
  containerSelector?: string
  locale?: PostLocale
  variant?: "default" | "editorial"
}

export function ParagraphCommentsLayer({ postId, isAdmin = false, containerSelector = "[data-post-content]", locale = "pt", variant = "default" }: Props) {
  const [activePid, setActivePid] = useState<string | null>(null)
  const [hoveredPid, setHoveredPid] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [paragraphIds, setParagraphIds] = useState<string[]>([])
  const [paragraphPositions, setParagraphPositions] = useState<ParagraphPosition[]>([])
  const [isTouch, setIsTouch] = useState(false)
  const [topicsHeight, setTopicsHeight] = useState(128)
  const layerRef = useRef<HTMLDivElement>(null)
  const hoveredPidRef = useRef<string | null>(null)
  const positionFrameRef = useRef<number | null>(null)
  const hideButtonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paragraphIdsKey = paragraphIds.join("\n")

  useEffect(() => {
    hoveredPidRef.current = hoveredPid
  }, [hoveredPid])

  const clearHideButtonTimer = useCallback(() => {
    if (hideButtonTimerRef.current) {
      clearTimeout(hideButtonTimerRef.current)
      hideButtonTimerRef.current = null
    }
  }, [])

  const scheduleHideButton = useCallback((delay = 250) => {
    clearHideButtonTimer()
    hideButtonTimerRef.current = setTimeout(() => setHoveredPid(null), delay)
  }, [clearHideButtonTimer])

  useEffect(() => {
    const container = document.querySelector<HTMLElement>(containerSelector)
    const layer = layerRef.current
    if (!container || !layer) return

    const measureParagraphs = () => {
      positionFrameRef.current = null
      const containerRect = container.getBoundingClientRect()
      const layerRect = layer.getBoundingClientRect()
      const paragraphs = Array.from(container.querySelectorAll<HTMLElement>("[data-pid]"))
      const next = paragraphs.flatMap((paragraph) => {
        const pid = paragraph.dataset.pid
        if (!pid || paragraph.getClientRects().length === 0) return []
        const rect = paragraph.getBoundingClientRect()
        const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight) || 24
        return [{
          pid,
          top: rect.top - layerRect.top + Math.max(0, (lineHeight - 32) / 2),
          left: containerRect.right - layerRect.left + 12,
        }]
      })
      setParagraphPositions((current) => current.length === next.length && current.every((entry, index) => (
        entry.pid === next[index].pid && Math.abs(entry.top - next[index].top) < 0.5 &&
        Math.abs(entry.left - next[index].left) < 0.5
      )) ? current : next)
    }
    const scheduleMeasure = () => {
      if (positionFrameRef.current === null) {
        positionFrameRef.current = window.requestAnimationFrame(measureParagraphs)
      }
    }
    const resizeObserver = new ResizeObserver(scheduleMeasure)
    const collectParagraphs = () => {
      const paragraphs = Array.from(container.querySelectorAll<HTMLElement>("[data-pid]"))
      const ids = paragraphs.map((paragraph) => paragraph.dataset.pid).filter((pid): pid is string => Boolean(pid))
      setParagraphIds((current) => current.join("\n") === ids.join("\n") ? current : ids)
      resizeObserver.disconnect()
      resizeObserver.observe(container)
      paragraphs.forEach((paragraph) => resizeObserver.observe(paragraph))
      scheduleMeasure()
    }

    collectParagraphs()
    const observer = new MutationObserver(collectParagraphs)
    observer.observe(container, { childList: true, subtree: true, characterData: true })
    window.addEventListener("resize", scheduleMeasure)

    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener("resize", scheduleMeasure)
      if (positionFrameRef.current !== null) {
        window.cancelAnimationFrame(positionFrameRef.current)
        positionFrameRef.current = null
      }
    }
  }, [containerSelector])

  useEffect(() => {
    const pids = paragraphIdsKey ? paragraphIdsKey.split("\n") : []
    if (pids.length === 0) return

    const controller = new AbortController()

    fetch(`/api/comments/${postId}/paragraph-counts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphIds: pids, locale }),
      signal: controller.signal,
    })
      .then((r) => r.ok ? r.json() : {})
      .then((next: Record<string, number>) => {
        setCounts(next)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setCounts({})
      })

    return () => {
      controller.abort()
    }
  }, [locale, paragraphIdsKey, postId])

  useEffect(() => {
    if (typeof window === "undefined") return

    const media = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 767px)")
    const update = () => setIsTouch(media.matches || navigator.maxTouchPoints > 0)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ height?: number }>).detail
      setTopicsHeight(typeof detail?.height === "number" && Number.isFinite(detail.height) && detail.height > 0 ? detail.height : 128)
    }

    window.addEventListener("paragraph-topics-compact-change", onChange)
    return () => window.removeEventListener("paragraph-topics-compact-change", onChange)
  }, [])

  useEffect(() => {
    const container = document.querySelector(containerSelector)
    if (!container) return

    const paragraphs = Array.from(container.querySelectorAll<HTMLElement>("[data-pid]"))
    paragraphs.forEach((paragraph) => paragraph.classList.add("paragraph-comments-target"))

    const onMouseMove = (event: Event) => {
      if (isTouch) return
      const target = event.target as HTMLElement
      const paragraph = target.closest<HTMLElement>("[data-pid]")
      if (!paragraph || !container.contains(paragraph)) return

      const pid = paragraph.dataset.pid
      if (!pid) return

      clearHideButtonTimer()
      if (hoveredPidRef.current !== pid) {
        hoveredPidRef.current = pid
        setHoveredPid(pid)
      }
    }

    const onMouseLeave = () => {
      if (!isTouch) scheduleHideButton()
    }

    container.addEventListener("mousemove", onMouseMove)
    container.addEventListener("mouseleave", onMouseLeave)

    const cleanups = paragraphs.map((paragraph) => {
      const pid = paragraph.dataset.pid
      if (!pid) return () => {}

      const onClick = (event: MouseEvent) => {
        if (!isTouch) return
        const target = event.target as HTMLElement
        if (target.closest("a, button, img, textarea, input, select, [contenteditable='true']")) return
        if (window.getSelection()?.toString().trim()) return
        setActivePid((current) => (current === pid ? null : pid))
      }

      paragraph.addEventListener("click", onClick)

      return () => {
        paragraph.removeEventListener("click", onClick)
      }
    })

    return () => {
      clearHideButtonTimer()
      container.removeEventListener("mousemove", onMouseMove)
      container.removeEventListener("mouseleave", onMouseLeave)
      paragraphs.forEach((paragraph) => paragraph.classList.remove("paragraph-comments-target"))
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [clearHideButtonTimer, containerSelector, isTouch, paragraphIdsKey, scheduleHideButton])

  const canUseDom = typeof document !== "undefined" && typeof window !== "undefined"
  const handleThreadCountChange = useCallback((count: number) => {
    if (!activePid) return
    setCounts((prev) => ({ ...prev, [activePid]: count }))
  }, [activePid])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("paragraph-comments-open-change", {
      detail: { open: Boolean(activePid) },
    }))

    return () => {
      window.dispatchEvent(new CustomEvent("paragraph-comments-open-change", {
        detail: { open: false },
      }))
    }
  }, [activePid])

  return (
    <div ref={layerRef} className="absolute inset-0 pointer-events-none">
      {!isTouch && paragraphPositions.map(({ pid, top, left }) => {
        const count = counts[pid] ?? 0
        const active = activePid === pid
        const visible = hoveredPid === pid || active || count > 0
        return (
          <div
            key={pid}
            className="absolute"
            style={{ top, left }}
          >
            <button
              type="button"
              onPointerEnter={clearHideButtonTimer}
              onPointerLeave={() => scheduleHideButton(250)}
              onFocus={() => {
                clearHideButtonTimer()
                setHoveredPid(pid)
              }}
              onBlur={() => scheduleHideButton(250)}
              onClick={() => {
                clearHideButtonTimer()
                setHoveredPid(pid)
                setActivePid((current) => current === pid ? null : pid)
              }}
              className={[
                "group relative flex min-h-8 w-9 items-center justify-center gap-0.5 py-2 text-neutral-500 transition-[opacity,color] duration-150 hover:text-neutral-950 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 motion-reduce:transition-none dark:text-[#8f8981] dark:hover:text-[#f1f1f1]",
                visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
                active ? "text-neutral-950 dark:text-[#f1f1f1]" : "",
              ].join(" ")}
              aria-label={count > 0 ? `${count} ${count === 1 ? "comentário neste parágrafo" : "comentários neste parágrafo"}` : "Comentar neste parágrafo"}
              aria-expanded={active}
              title={active ? "Fechar comentários deste parágrafo" : "Comentar neste parágrafo"}
            >
              <span aria-hidden className="absolute -left-1 top-1.5 h-5 w-px bg-current opacity-25 group-hover:opacity-50" />
              <ChatBubbleLeftRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
              {count > 0 && <span className="text-[10px] leading-none tabular-nums" aria-hidden>{count > 99 ? "99+" : count}</span>}
            </button>
          </div>
        )
      })}

      {canUseDom && activePid && createPortal(
        <div
          className={[
            "pointer-events-auto fixed right-4 bottom-4 left-4 z-[70] sm:left-auto sm:w-80 xl:bottom-4",
            variant === "editorial"
              ? "xl:left-auto xl:right-4 xl:top-[8rem] xl:w-72"
              : "xl:right-auto xl:left-[var(--post-sidebar-left)] xl:w-[var(--post-sidebar-width)] xl:top-[calc(6rem+var(--post-topics-height))]",
          ].join(" ")}
          style={{ "--post-topics-height": `${topicsHeight}px` } as CSSProperties}
        >
          <ParagraphThread
            postId={postId}
            paragraphId={activePid}
            locale={locale}
            isAdmin={isAdmin}
            autoFocus={isTouch}
            onCountChange={handleThreadCountChange}
            onClose={() => setActivePid(null)}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
