"use client"

import { useEffect } from "react"
import { getPostEngagement } from "@/lib/post-engagement"

const CHECKPOINTS = [0.25, 0.5, 0.75, 0.9]

export function PostEngagementTracker({ publicId, readingTimeMinutes }: { publicId: string; readingTimeMinutes: number }) {
  useEffect(() => {
    let token = getPostEngagement(publicId)?.token ?? null
    let activeSeconds = 0
    let nextCheckpoint = 0
    let maxProgress = 0
    let completed = false
    let frame = 0
    const minimumActiveSeconds = Math.max(45, Math.round(readingTimeMinutes * 60 * 0.4))

    function onToken(event: Event) {
      const detail = (event as CustomEvent<{ publicId?: string; token?: string }>).detail
      if (detail?.publicId === publicId && detail.token) token = detail.token
    }

    function measure() {
      frame = 0
      if (completed || document.visibilityState !== "visible" || !document.hasFocus()) return
      const content = document.querySelector<HTMLElement>("[data-post-content]")
      if (!content) return
      const rect = content.getBoundingClientRect()
      if (rect.height <= 0) return

      const wholeContentVisible = rect.height <= window.innerHeight * 0.8
      const position = Math.max(0, Math.min(1, (window.innerHeight * 0.5 - rect.top) / rect.height))
      maxProgress = Math.max(maxProgress, position)
      if (wholeContentVisible && activeSeconds >= minimumActiveSeconds) {
        nextCheckpoint = CHECKPOINTS.length
        maxProgress = 1
      }
      const checkpoint = CHECKPOINTS[nextCheckpoint]
      if (checkpoint !== undefined) {
        const enoughTime = activeSeconds >= minimumActiveSeconds * checkpoint * 0.5
        if (enoughTime && position >= checkpoint - 0.12 && position <= checkpoint + 0.15) {
          nextCheckpoint += 1
        }
      }

      const reachedEnd = wholeContentVisible || rect.bottom <= window.innerHeight * 0.9
      if (!token || !reachedEnd || nextCheckpoint < CHECKPOINTS.length || activeSeconds < minimumActiveSeconds) return
      completed = true
      void fetch("/api/engagement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          event: "reading_completed",
          activeSeconds,
          progress: Math.round(maxProgress * 100),
        }),
        keepalive: true,
      }).catch(() => undefined)
    }

    function scheduleMeasure() {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) activeSeconds += 1
      scheduleMeasure()
    }, 1000)

    window.addEventListener("post-engagement-ready", onToken)
    window.addEventListener("scroll", scheduleMeasure, { passive: true })
    window.addEventListener("resize", scheduleMeasure)
    scheduleMeasure()

    return () => {
      window.clearInterval(timer)
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("post-engagement-ready", onToken)
      window.removeEventListener("scroll", scheduleMeasure)
      window.removeEventListener("resize", scheduleMeasure)
    }
  }, [publicId, readingTimeMinutes])

  return null
}
