"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ComputerDesktopIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { formatSiteDate } from "@/lib/datetime"

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
    <div className="admin-push-devices">
      {devices.map((device) => (
        <div key={device.id} className="admin-push-device">
          <span className="admin-push-device-icon"><ComputerDesktopIcon aria-hidden /></span>
          <div>
            <strong>{device.label}</strong>
            <span>
              Atualizado em {formatSiteDate(device.updatedAt, { dateStyle: "short", timeStyle: "short" })}
              {device.lastSuccessAt ? ` · último envio ${formatSiteDate(device.lastSuccessAt, { dateStyle: "short", timeStyle: "short" })}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void revoke({ id: device.id }, device.id)}
            disabled={busy !== null}
            aria-label={`Revogar alertas privados em ${device.label}`}
            title="Revogar alertas privados"
            className="admin-icon-button admin-push-revoke"
          >
            <XMarkIcon className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <div className="admin-push-device-footer">
        <p role="status">{message}</p>
        {devices.length > 1 && (
          <button
            type="button"
            onClick={() => void revoke({ all: true }, "all")}
            disabled={busy !== null}
            className="admin-danger-text"
          >
            Revogar todos
          </button>
        )}
      </div>
    </div>
  )
}
