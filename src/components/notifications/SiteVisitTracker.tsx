"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { viewClientContext } from "@/lib/view-referrer"

let lastReportedPath = ""
let disabledForSession = false

export function SiteVisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (disabledForSession || !pathname || pathname === lastReportedPath) return
    lastReportedPath = pathname

    fetch("/api/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, ...viewClientContext() }),
      keepalive: true,
    }).then((response) => {
      if (response.status === 204) disabledForSession = true
    }).catch(() => undefined)
  }, [pathname])

  return null
}
