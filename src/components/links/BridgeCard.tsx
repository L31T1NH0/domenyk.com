"use client"

import { useEffect, useState } from "react"
import { currentBridge, currentBridgePresence, parseBridgeStatus, type BridgeStatus } from "@/lib/bridge"
import { BridgeMatch, MinecraftPresence } from "./BridgeMatch"

export function BridgeCard() {
  const [status, setStatus] = useState<BridgeStatus>({ current: null })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch("/api/links/bridge", { cache: "no-store", priority: "low", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
          if (!response.ok) throw new Error("Partida indisponível")
          const data = parseBridgeStatus(await response.json())
          if (active) { setStatus(data); setNow(Date.now()) }
        }
      } catch {
        if (active) setStatus({ current: null })
      } finally {
        if (active) timer = setTimeout(refresh, 3000)
      }
    }
    const clock = setInterval(() => setNow(Date.now()), 1000)
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer); clearInterval(clock) }
  }, [])

  const match = currentBridge(status, now)
  if (match) return <BridgeMatch {...match} />
  const presence = currentBridgePresence(status, now)
  return presence ? <MinecraftPresence waiting={presence.activity === "waiting"} /> : null
}
