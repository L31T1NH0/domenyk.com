"use client"

import { useEffect } from "react"
import { NOTE_VIEW_TTL_MS } from "@/lib/note-views"

const pendingDirectViews = new Set<string>()

export function NoteViewTracker({ noteId, minimumVisibleMs }: { noteId: string; minimumVisibleMs: number }) {
  useEffect(() => {
    const storageKey = `note-viewed:direct:${noteId}`
    const now = Date.now()
    try {
      const previous = Number(localStorage.getItem(storageKey) ?? 0)
      if (previous && now - previous < NOTE_VIEW_TTL_MS) return
    } catch {}
    if (pendingDirectViews.has(noteId)) return

    let cancelled = false
    let timer: number | null = null

    const clearTimer = () => {
      if (timer === null) return
      window.clearTimeout(timer)
      timer = null
    }

    const countView = () => {
      timer = null
      if (cancelled) return
      pendingDirectViews.add(noteId)
      fetch(`/api/notes/${noteId}/view`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "direct" }),
      }).then((response) => {
        if (!cancelled && response.ok) {
          try { localStorage.setItem(storageKey, String(Date.now())) } catch {}
        }
      }).catch(() => undefined).finally(() => pendingDirectViews.delete(noteId))
    }

    const syncTimer = () => {
      clearTimer()
      if (document.visibilityState === "visible") {
        timer = window.setTimeout(countView, minimumVisibleMs)
      }
    }

    document.addEventListener("visibilitychange", syncTimer)
    syncTimer()

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", syncTimer)
      clearTimer()
    }
  }, [minimumVisibleMs, noteId])

  return null
}
