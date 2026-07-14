"use client"

import { useCallback, useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { BellAlertIcon, BellSlashIcon } from "@heroicons/react/24/outline"
import { applicationServerKey } from "@/lib/client-push"

type Topic = "posts" | "notes"
type State = "loading" | "ready" | "saving" | "enabled" | "denied" | "unsupported" | "unconfigured" | "error"

export function PushSubscriptionManager({
  showAdminEvents = false,
  compact = false,
}: {
  showAdminEvents?: boolean
  compact?: boolean
}) {
  const { isLoaded, isSignedIn, user } = useUser()
  const [state, setState] = useState<State>("loading")
  const [publicKey, setPublicKey] = useState("")
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [adminEvents, setAdminEvents] = useState(false)
  const [messageEvents, setMessageEvents] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported")
      return
    }
    if (Notification.permission === "denied") {
      setState("denied")
      return
    }
    try {
      const response = await fetch("/api/push/config", { cache: "no-store" })
      const config = await response.json() as { configured?: boolean; publicKey?: string | null }
      if (!config.configured || !config.publicKey) {
        setState("unconfigured")
        return
      }
      setPublicKey(config.publicKey)
      const registration = await navigator.serviceWorker.register("/push-service-worker.js", { scope: "/" })
      const current = await registration.pushManager.getSubscription()
      setSubscription(current)
      if (!current) {
        setState("ready")
        return
      }
      const statusResponse = await fetch("/api/push/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: current.endpoint }),
      })
      const status = statusResponse.ok
        ? await statusResponse.json() as { topics?: Topic[]; adminEvents?: boolean; messageEvents?: boolean }
        : { topics: [] as Topic[], adminEvents: false, messageEvents: false }
      setTopics(status.topics ?? [])
      setAdminEvents(status.adminEvents === true)
      setMessageEvents(status.messageEvents === true)
      setState("enabled")
    } catch {
      setState("error")
      setMessage("Não foi possível consultar as notificações neste dispositivo.")
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    const refresh = () => void load()
    window.addEventListener("push:preferences-changed", refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("push:preferences-changed", refresh)
    }
  }, [load, user?.id])

  async function persist(current: PushSubscription, nextTopics: Topic[], nextAdminEvents: boolean, nextMessageEvents: boolean) {
    const json = current.toJSON()
    const response = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...json, topics: nextTopics, adminEvents: nextAdminEvents, messageEvents: nextMessageEvents }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(data?.error || "Não foi possível salvar suas preferências.")
    }
  }

  async function enable() {
    setState("saving")
    setMessage("")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      })
      const nextTopics: Topic[] = ["posts", "notes"]
      const nextAdminEvents = false
      const nextMessageEvents = false
      await persist(current, nextTopics, nextAdminEvents, nextMessageEvents)
      setSubscription(current)
      setTopics(nextTopics)
      setAdminEvents(nextAdminEvents)
      setMessageEvents(nextMessageEvents)
      setState("enabled")
      setMessage("Notificações ativadas neste dispositivo.")
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "Não foi possível ativar as notificações.")
    }
  }

  async function updatePreference(topic: Topic | "admin" | "messages", checked: boolean) {
    if (!subscription) return
    const nextTopics = topic === "admin" || topic === "messages"
      ? topics
      : checked ? Array.from(new Set([...topics, topic])) : topics.filter((item) => item !== topic)
    const nextAdminEvents = topic === "admin" ? checked : adminEvents
    const nextMessageEvents = topic === "messages" ? checked : messageEvents
    setState("saving")
    setMessage("")
    try {
      await persist(subscription, nextTopics, nextAdminEvents, nextMessageEvents)
      setTopics(nextTopics)
      setAdminEvents(nextAdminEvents)
      setMessageEvents(nextMessageEvents)
      setState("enabled")
      setMessage("Preferências salvas.")
    } catch (error) {
      setState("enabled")
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar suas preferências.")
    }
  }

  async function disable() {
    if (!subscription) return
    setState("saving")
    setMessage("")
    try {
      await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
      setSubscription(null)
      setTopics([])
      setAdminEvents(false)
      setMessageEvents(false)
      setState("ready")
      setMessage("Notificações desativadas neste dispositivo.")
    } catch {
      setState("enabled")
      setMessage("Não foi possível desativar as notificações.")
    }
  }

  const bodyTextClass = compact ? "text-xs leading-5" : "text-sm leading-relaxed"

  if (state === "loading") return <p className={`${bodyTextClass} text-zinc-500 dark:text-zinc-400`}>Consultando este dispositivo…</p>
  if (state === "unsupported") return <p className={`${bodyTextClass} text-zinc-600 dark:text-zinc-300`}>Este navegador não oferece notificações para sites.</p>
  if (state === "unconfigured") return <p className={`${bodyTextClass} text-zinc-600 dark:text-zinc-300`}>As notificações ainda não foram configuradas pelo site.</p>
  if (state === "denied") return <p className={`${bodyTextClass} text-zinc-600 dark:text-zinc-300`}>As notificações estão bloqueadas nas configurações do navegador. Altere a permissão do site para poder ativá-las.</p>

  if (!subscription) return (
    <div>
      <button
        type="button"
        onClick={enable}
        disabled={state === "saving" || !publicKey}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3.5 py-2 font-medium text-white outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-[#040404] ${compact ? "w-full text-xs" : "text-sm"}`}
      >
        <BellAlertIcon className="size-[18px]" aria-hidden />
        {state === "saving" ? "Ativando…" : "Ativar notificações"}
      </button>
      {message && <p className={`mt-3 text-zinc-600 dark:text-zinc-300 ${compact ? "text-xs leading-5" : "text-sm"}`} role="status">{message}</p>}
    </div>
  )

  const disabled = state === "saving"
  return (
    <div>
      <fieldset disabled={disabled} className={compact ? "space-y-1" : "space-y-2.5"}>
        <legend className={`font-medium text-zinc-950 dark:text-white ${compact ? "mb-2 text-xs" : "mb-3 text-sm"}`}>Avisar neste dispositivo sobre</legend>
        <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${compact ? "min-h-9" : "min-h-10"}`}>
          <span className={`${compact ? "text-xs" : "text-sm"} text-zinc-700 dark:text-zinc-200`}>Novos posts</span>
          <input type="checkbox" checked={topics.includes("posts")} onChange={(event) => void updatePreference("posts", event.target.checked)} className="size-4 accent-zinc-950 dark:accent-white" />
        </label>
        <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${compact ? "min-h-9" : "min-h-10"}`}>
          <span className={`${compact ? "text-xs" : "text-sm"} text-zinc-700 dark:text-zinc-200`}>Novas notas</span>
          <input type="checkbox" checked={topics.includes("notes")} onChange={(event) => void updatePreference("notes", event.target.checked)} className="size-4 accent-zinc-950 dark:accent-white" />
        </label>
        {isLoaded && isSignedIn && (
          <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${compact ? "min-h-10" : "min-h-10"}`}>
            <span><span className={`block text-zinc-700 dark:text-zinc-200 ${compact ? "text-xs" : "text-sm"}`}>Mensagens privadas</span><span className={`block text-zinc-500 dark:text-zinc-400 ${compact ? "mt-0.5 text-[10px] leading-4" : "text-xs"}`}>Quando Domenyk responder uma conversa</span></span>
            <input type="checkbox" checked={messageEvents} onChange={(event) => void updatePreference("messages", event.target.checked)} className="size-4 accent-zinc-950 dark:accent-white" />
          </label>
        )}
        {showAdminEvents && (
          <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${compact ? "min-h-10" : "min-h-10"}`}>
            <span><span className={`block text-zinc-700 dark:text-zinc-200 ${compact ? "text-xs" : "text-sm"}`}>Atividade privada</span><span className={`block text-zinc-500 dark:text-zinc-400 ${compact ? "mt-0.5 text-[10px] leading-4" : "text-xs"}`}>Comentários, mensagens e visitas identificadas</span></span>
            <input type="checkbox" checked={adminEvents} onChange={(event) => void updatePreference("admin", event.target.checked)} className="size-4 accent-zinc-950 dark:accent-white" />
          </label>
        )}
      </fieldset>
      <div className={`flex flex-wrap items-center gap-3 border-t border-zinc-200 dark:border-white/10 ${compact ? "mt-3 pt-3" : "mt-4 pt-4"}`}>
        <button type="button" onClick={() => void disable()} disabled={disabled} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-zinc-600 outline-none hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white ${compact ? "text-xs" : "text-sm"}`}>
          <BellSlashIcon className="size-[17px]" aria-hidden />
          Desativar neste dispositivo
        </button>
        {message && <p className={`${compact ? "text-xs leading-5" : "text-sm"} text-zinc-500 dark:text-zinc-400`} role="status">{message}</p>}
      </div>
    </div>
  )
}
