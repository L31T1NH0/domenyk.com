"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"
import { ParagraphThread } from "./ParagraphThread"

type Props = {
  postId: string
  isAdmin?: boolean
  containerSelector?: string
}

export function ParagraphCommentsLayer({ postId, isAdmin = false, containerSelector = "[data-post-content]" }: Props) {
  const [activePid, setActivePid] = useState<string | null>(null)
  const [hoveredPid, setHoveredPid] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [positions, setPositions] = useState<Record<string, { top: number }>>({})
  const [isTouch, setIsTouch] = useState(false)
  const layerRef = useRef<HTMLDivElement>(null)
  const hideButtonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paragraphIds = useMemo(() => Object.keys(positions), [positions])
  const paragraphIdsKey = paragraphIds.join("\n")

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

  useEffect(() => {
    const container = document.querySelector(containerSelector)
    if (!container) return

    function buildPositions() {
      const pEls = container!.querySelectorAll<HTMLElement>("[data-pid]")
      const next: Record<string, { top: number }> = {}
      pEls.forEach((el) => {
        const pid = el.dataset.pid!
        next[pid] = { top: el.offsetTop }
      })
      setPositions(next)
    }

    buildPositions()
    const ro = new ResizeObserver(buildPositions)
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerSelector])

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
      setHoveredPid(pid)
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
  }, [clearHideButtonTimer, containerSelector, isTouch, scheduleHideButton])

  const buttonPid = hoveredPid && positions[hoveredPid] ? hoveredPid : null
  const handleThreadCountChange = useCallback((count: number) => {
    if (!activePid) return
    setCounts((prev) => ({ ...prev, [activePid]: count }))
  }, [activePid])

  return (
    <div ref={layerRef} className="absolute inset-0 pointer-events-none">
      {!isTouch && buttonPid && (
        <div
          className="absolute -right-2 translate-x-full pointer-events-auto flex items-center"
          style={{ top: positions[buttonPid].top }}
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
            className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-[#E00070]/50 hover:bg-[#E00070] hover:text-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-[#E00070]/50 dark:hover:bg-[#E00070]"
            aria-label="Abrir comentários deste parágrafo"
            title="Comentar neste parágrafo"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
            {counts[buttonPid] ? <span>{counts[buttonPid]}</span> : null}
          </button>
        </div>
      )}

      {activePid && positions[activePid] && (
        <div
          className="absolute right-0 pointer-events-auto"
          style={{ top: positions[activePid].top }}
        >
          <div className="relative">
            <ParagraphThread
              postId={postId}
              paragraphId={activePid}
              isAdmin={isAdmin}
              autoFocus={isTouch}
              onCountChange={handleThreadCountChange}
              onClose={() => setActivePid(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
