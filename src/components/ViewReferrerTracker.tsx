"use client"

import { useEffect } from "react"
import { initializeVisitorContext, rememberInternalReferrer } from "@/lib/view-referrer"

export function ViewReferrerTracker() {
  useEffect(() => {
    initializeVisitorContext()

    function captureNavigation(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return

      const target = new URL(anchor.href, window.location.href)
      if (target.origin !== window.location.origin || target.href === window.location.href) return
      rememberInternalReferrer(window.location.href, target.href)
    }

    document.addEventListener("click", captureNavigation, { capture: true })
    return () => document.removeEventListener("click", captureNavigation, { capture: true })
  }, [])

  return null
}
