"use client"

import { ArrowUpIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { useCallback, useEffect, useRef, useState } from "react"

type Props = {
  postId: string
  updatedAt: string
}

type SavedPosition = {
  contentOffset: number
  progress: number
  updatedAt: string
  savedAt: number
}

const storagePrefix = "domenyk:post-reading-position:"
const maxAgeMs = 1000 * 60 * 60 * 24 * 90
const minRestorableOffset = 180
const completionThreshold = 0.96

function getStorageKey(postId: string) {
  return `${storagePrefix}${postId}`
}

function getContentMetrics(content: HTMLElement) {
  const contentTop = content.getBoundingClientRect().top + window.scrollY
  const totalScrollable = Math.max(content.scrollHeight - window.innerHeight, 1)
  const contentOffset = Math.max(0, window.scrollY - contentTop)
  const progress = Math.min(1, Math.max(0, contentOffset / totalScrollable))

  return { contentTop, contentOffset, progress, totalScrollable }
}

function readSavedPosition(key: string, updatedAt: string): SavedPosition | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const saved = JSON.parse(raw) as Partial<SavedPosition>
    if (
      typeof saved.contentOffset !== "number" ||
      typeof saved.progress !== "number" ||
      typeof saved.savedAt !== "number" ||
      saved.updatedAt !== updatedAt ||
      Date.now() - saved.savedAt > maxAgeMs
    ) {
      window.localStorage.removeItem(key)
      return null
    }

    return saved as SavedPosition
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function PostReadingPosition({ postId, updatedAt }: Props) {
  const [restored, setRestored] = useState(false)
  const noticeTimerRef = useRef<number | null>(null)
  const lastPositionRef = useRef<SavedPosition | null>(null)

  const clearNoticeTimer = useCallback(() => {
    if (!noticeTimerRef.current) return
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = null
  }, [])

  const startNoticeTimer = useCallback(() => {
    clearNoticeTimer()
    noticeTimerRef.current = window.setTimeout(() => {
      setRestored(false)
      noticeTimerRef.current = null
    }, 8000)
  }, [clearNoticeTimer])

  useEffect(() => {
    const content = document.querySelector<HTMLElement>("[data-post-content]")
    if (!content) return

    const key = getStorageKey(postId)
    const saved = window.location.hash ? null : readSavedPosition(key, updatedAt)
    lastPositionRef.current = saved
    let saveFrame = 0
    let restoreFrame = 0
    let restoreTimer: number | null = null

    const restore = () => {
      if (!saved) return
      if (saved.contentOffset < minRestorableOffset || saved.progress >= completionThreshold) return

      const { contentTop, totalScrollable } = getContentMetrics(content)
      const offset = Math.min(saved.contentOffset, totalScrollable)
      window.scrollTo({ top: Math.max(0, contentTop + offset), behavior: "auto" })
      setRestored(true)
      startNoticeTimer()
    }

    const scheduleRestore = () => {
      restoreFrame = window.requestAnimationFrame(() => {
        restoreFrame = window.requestAnimationFrame(() => {
          restoreFrame = 0
          restore()
        })
      })
    }

    const writePosition = (value: SavedPosition) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage can be unavailable in private contexts; reading should continue normally.
      }
    }

    const save = () => {
      saveFrame = 0
      const { contentOffset, progress } = getContentMetrics(content)

      if (contentOffset >= minRestorableOffset && progress < completionThreshold) {
        const value: SavedPosition = {
          contentOffset,
          progress,
          updatedAt,
          savedAt: Date.now(),
        }

        lastPositionRef.current = value
        writePosition(value)
        return
      }

      if (progress >= completionThreshold) {
        lastPositionRef.current = null
        window.localStorage.removeItem(key)
      }
    }

    const saveLastKnownPosition = () => {
      if (lastPositionRef.current) writePosition({ ...lastPositionRef.current, savedAt: Date.now() })
    }

    const requestSave = () => {
      if (saveFrame) return
      saveFrame = window.requestAnimationFrame(save)
    }

    const saveBeforeNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a") : null
      if (target) save()
    }

    scheduleRestore()
    restoreTimer = window.setTimeout(restore, 700)
    window.addEventListener("scroll", requestSave, { passive: true })
    window.addEventListener("resize", requestSave)
    window.addEventListener("pagehide", saveLastKnownPosition)
    document.addEventListener("click", saveBeforeNavigation, { capture: true })

    return () => {
      window.removeEventListener("scroll", requestSave)
      window.removeEventListener("resize", requestSave)
      window.removeEventListener("pagehide", saveLastKnownPosition)
      document.removeEventListener("click", saveBeforeNavigation, { capture: true })
      if (saveFrame) window.cancelAnimationFrame(saveFrame)
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame)
      if (restoreTimer) window.clearTimeout(restoreTimer)
      clearNoticeTimer()
      saveLastKnownPosition()
    }
  }, [clearNoticeTimer, postId, startNoticeTimer, updatedAt])

  const returnToStart = () => {
    try {
      window.localStorage.removeItem(getStorageKey(postId))
    } catch {
      // Ignore unavailable local storage; the scroll action is the important part.
    }
    setRestored(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!restored) return null

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-5"
    >
      <div
        onMouseEnter={clearNoticeTimer}
        onMouseLeave={startNoticeTimer}
        onFocus={clearNoticeTimer}
        onBlur={startNoticeTimer}
        className="flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 sm:max-w-sm"
      >
        <span className="min-w-0 truncate">Você voltou de onde parou</span>
        <button
          type="button"
          onClick={returnToStart}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#C00060] transition hover:bg-zinc-100 hover:text-[#E00070] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070] dark:text-[#ff4aa3] dark:hover:bg-white/10 dark:hover:text-[#ff7abd]"
        >
          <ArrowUpIcon className="h-3.5 w-3.5" aria-hidden />
          Topo
        </button>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => setRestored(false)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070] dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
