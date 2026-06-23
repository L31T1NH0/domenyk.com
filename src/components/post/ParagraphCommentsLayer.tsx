"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"
import { ParagraphThread } from "./ParagraphThread"

type ParagraphPosition = {
  top: number
  right: number
}

type Props = {
  postId: string
  isAdmin?: boolean
  containerSelector?: string
}

export function ParagraphCommentsLayer({ postId, isAdmin = false, containerSelector = "[data-post-content]" }: Props) {
  const [activePid, setActivePid] = useState<string | null>(null)
  const [hoveredPid, setHoveredPid] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [paragraphIds, setParagraphIds] = useState<string[]>([])
  const [buttonPosition, setButtonPosition] = useState<ParagraphPosition | null>(null)
  const [isTouch, setIsTouch] = useState(false)
  const [compactTopicsExpanded, setCompactTopicsExpanded] = useState(false)
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

  const scheduleHideButton = useCallback((delay = 1200) => {
    clearHideButtonTimer()
    hideButtonTimerRef.current = setTimeout(() => setHoveredPid(null), delay)
  }, [clearHideButtonTimer])

  const updateButtonPosition = useCallback((pid: string) => {
    const container = document.querySelector(containerSelector)
    const paragraph = container?.querySelector<HTMLElement>(`[data-pid="${CSS.escape(pid)}"]`)

    if (!paragraph) {
      setButtonPosition(null)
      return
    }

    const rect = paragraph.getBoundingClientRect()
    const next = {
      top: rect.top,
      right: rect.right,
    }

    setButtonPosition((current) => (
      current && Math.abs(current.top - next.top) < 0.5 && Math.abs(current.right - next.right) < 0.5
        ? current
        : next
    ))
  }, [containerSelector])

  useEffect(() => {
    const container = document.querySelector(containerSelector)
    if (!container) return

    function collectParagraphIds() {
      const next = Array.from(container!.querySelectorAll<HTMLElement>("[data-pid]"), (el) => el.dataset.pid)
        .filter((pid): pid is string => Boolean(pid))

      setParagraphIds((current) => current.join("\n") === next.join("\n") ? current : next)
    }

    const scheduleHoveredPositionUpdate = () => {
      const pid = hoveredPidRef.current
      if (!pid || positionFrameRef.current !== null) return

      positionFrameRef.current = window.requestAnimationFrame(() => {
        positionFrameRef.current = null
        updateButtonPosition(pid)
      })
    }

    collectParagraphIds()
    const observer = new MutationObserver(collectParagraphIds)
    observer.observe(container, { childList: true, subtree: true })
    window.addEventListener("scroll", scheduleHoveredPositionUpdate, { passive: true })
    window.addEventListener("resize", scheduleHoveredPositionUpdate)

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", scheduleHoveredPositionUpdate)
      window.removeEventListener("resize", scheduleHoveredPositionUpdate)
      if (positionFrameRef.current !== null) {
        window.cancelAnimationFrame(positionFrameRef.current)
        positionFrameRef.current = null
      }
    }
  }, [containerSelector, updateButtonPosition])

  useEffect(() => {
    const pids = paragraphIdsKey ? paragraphIdsKey.split("\n") : []
    if (pids.length === 0) return

    const controller = new AbortController()

    fetch(`/api/comments/${postId}/paragraph-counts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphIds: pids }),
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
  }, [paragraphIdsKey, postId])

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
      const detail = (event as CustomEvent<{ expanded?: boolean }>).detail
      setCompactTopicsExpanded(Boolean(detail?.expanded))
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
        updateButtonPosition(pid)
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
        if (target.closest("a, button, img, textarea, input, select")) return
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
  }, [clearHideButtonTimer, containerSelector, isTouch, scheduleHideButton, updateButtonPosition])

  const buttonPid = hoveredPid && buttonPosition ? hoveredPid : null
  const canUseDom = typeof document !== "undefined" && typeof window !== "undefined"
  const viewportWidth = canUseDom ? window.innerWidth : 0
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
      {canUseDom && !isTouch && buttonPid && buttonPosition && createPortal(
        <div
          className="pointer-events-auto fixed z-[70] flex items-center"
          style={{
            top: buttonPosition.top - 2,
            left: Math.min(buttonPosition.right + 10, viewportWidth - 44),
          }}
          onPointerEnter={clearHideButtonTimer}
          onPointerLeave={() => scheduleHideButton()}
        >
          <button
            type="button"
            onClick={() => {
              clearHideButtonTimer()
              setHoveredPid(buttonPid)
              setActivePid(buttonPid)
            }}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-950/15 bg-[#f4f4f4] text-neutral-800 shadow-[0_2px_8px_rgb(0_0_0_/_0.12)] transition-colors hover:border-[#E00070]/70 hover:bg-[#E00070] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/70 dark:border-white/15 dark:bg-[#040404] dark:text-[#f1f1f1] dark:shadow-none dark:hover:border-[#E00070]/70 dark:hover:bg-[#E00070]"
            aria-label="Abrir comentários deste parágrafo"
            title="Comentar neste parágrafo"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
            {counts[buttonPid] ? (
              <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#E00070] px-1 text-[10px] font-semibold leading-none text-white">
                {counts[buttonPid]}
              </span>
            ) : null}
          </button>
        </div>,
        document.body
      )}

      {canUseDom && activePid && createPortal(
        <div
          className={[
            "pointer-events-auto fixed right-4 bottom-4 left-4 z-[70] sm:left-auto sm:w-80 xl:bottom-4 xl:right-auto xl:left-[calc(50%+20rem)] xl:w-64",
            compactTopicsExpanded ? "xl:top-[17rem]" : "xl:top-[14rem]",
          ].join(" ")}
        >
          <ParagraphThread
            postId={postId}
            paragraphId={activePid}
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
