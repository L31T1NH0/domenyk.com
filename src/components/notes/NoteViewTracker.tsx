"use client"

import { useEffect } from "react"
import { NOTE_VIEW_TTL_MS } from "@/lib/note-views"
import { viewClientContext } from "@/lib/view-referrer"

const pendingDirectViews = new Set<string>()

export function NoteViewTracker({ noteId }: { noteId: string }) {
  useEffect(() => {
    const storageKey = `note-viewed:direct:${noteId}`
    const now = Date.now()
    try {
      const previous = Number(localStorage.getItem(storageKey) ?? 0)
      if (previous && now - previous < NOTE_VIEW_TTL_MS) return
    } catch {}
    if (pendingDirectViews.has(noteId)) return

    let cancelled = false
    pendingDirectViews.add(noteId)
    fetch(`/api/notes/${noteId}/view`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "direct", ...viewClientContext() }),
    }).then((response) => {
      if (!cancelled && response.ok) {
        try { localStorage.setItem(storageKey, String(Date.now())) } catch {}
      }
    }).catch(() => undefined).finally(() => pendingDirectViews.delete(noteId))

    return () => {
      cancelled = true
    }
  }, [noteId])

  return null
}
