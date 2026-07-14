"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ComputerDesktopIcon, XMarkIcon } from "@heroicons/react/24/outline"

export type AdminPushDevice = {
  id: string
  label: string
  updatedAt: string
  lastSuccessAt?: string
}

export function AdminPushDevices({ devices }: { devices: AdminPushDevice[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  async function revoke(body: { id: string } | { all: true }, key: string) {
    setBusy(key)
    setMessage("")
    try {
      const response = await fetch("/api/admin/push/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível revogar o dispositivo.")
      setMessage(key === "all" ? "Alertas privados revogados em todos os dispositivos." : "Alertas privados revogados neste dispositivo.")
      window.dispatchEvent(new Event("push:preferences-changed"))
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível revogar o dispositivo.")
    } finally {
      setBusy(null)
    }
  }

  if (devices.length === 0) {
    return <p className="admin-empty">Nenhum dispositivo recebe atividade privada.</p>
  }

  return (
    <div>
      {devices.map((device) => (
        <div key={device.id} className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 last:border-b-0 dark:border-neutral-800">
          <ComputerDesktopIcon className="size-5 shrink-0 text-neutral-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-neutral-900 dark:text-neutral-100">{device.label}</strong>
            <span className="mt-0.5 block text-[11px] text-neutral-500">
              Atualizado em {new Date(device.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              {device.lastSuccessAt ? ` · último envio ${new Date(device.lastSuccessAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void revoke({ id: device.id }, device.id)}
            disabled={busy !== null}
            aria-label={`Revogar alertas privados em ${device.label}`}
            title="Revogar alertas privados"
            className="grid size-8 shrink-0 place-items-center rounded-md text-neutral-500 outline-none transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          >
            <XMarkIcon className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-[11px] text-neutral-500" role="status">{message}</p>
        {devices.length > 1 && (
          <button
            type="button"
            onClick={() => void revoke({ all: true }, "all")}
            disabled={busy !== null}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-700 outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Revogar todos
          </button>
        )}
      </div>
    </div>
  )
}
