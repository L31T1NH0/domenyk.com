"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function DefaultThemeInitializer() {
  const router = useRouter()

  useEffect(() => {
    fetch("/api/admin/themes/defaults", { method: "POST" })
      .then((response) => response.ok ? response.json() : { created: 0 })
      .then((result) => {
        if (Number(result.created) > 0) router.refresh()
      })
      .catch(() => undefined)
  }, [router])

  return null
}
