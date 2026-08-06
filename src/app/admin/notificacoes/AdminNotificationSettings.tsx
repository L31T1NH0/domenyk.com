"use client"

import { useState } from "react"

export function AdminNotificationSettings({
  initialSiteVisitsEnabled,
  initialStoreSiteVisits,
  webhookConfigured,
}: {
  initialSiteVisitsEnabled: boolean
  initialStoreSiteVisits: boolean
  webhookConfigured: boolean
}) {
  const [siteVisitsEnabled, setSiteVisitsEnabled] = useState(initialSiteVisitsEnabled)
  const [storeSiteVisits, setStoreSiteVisits] = useState(initialStoreSiteVisits)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function save(nextEnabled: boolean, nextStore: boolean) {
    const previousEnabled = siteVisitsEnabled
    const previousStore = storeSiteVisits
    setSiteVisitsEnabled(nextEnabled)
    setStoreSiteVisits(nextStore)
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteVisitsEnabled: nextEnabled,
          storeSiteVisits: nextStore,
        }),
      })
      const data = await response.json().catch(() => null) as {
        error?: string
        siteVisitsEnabled?: boolean
        storeSiteVisits?: boolean
      } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar as configurações.")
      setSiteVisitsEnabled(data?.siteVisitsEnabled === true)
      setStoreSiteVisits(data?.storeSiteVisits === true)
      setMessage("Configuração salva.")
    } catch (error) {
      setSiteVisitsEnabled(previousEnabled)
      setStoreSiteVisits(previousStore)
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as configurações.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-workspace-panel admin-notification-settings">
      <header className="admin-workspace-header">
        <div>
          <h2>Origens e armazenamento</h2>
          <p>Controle quando o site pode gerar eventos e o que entra na central</p>
        </div>
      </header>
      <div className="admin-notification-settings-grid" aria-busy={saving}>
        <div>
          <p className="admin-notification-settings-kicker">Visitas em tempo real</p>
          <label className="admin-toggle-row">
            <span>
              <strong>Notificar qualquer visita ao site</strong>
              <small>Quando desligado, o rastreador nem é enviado às páginas públicas e não chama a API.</small>
            </span>
            <input
              type="checkbox"
              checked={siteVisitsEnabled}
              disabled={saving}
              onChange={(event) => void save(event.target.checked, storeSiteVisits)}
            />
          </label>
          <label className="admin-toggle-row">
            <span>
              <strong>Salvar visitas na central</strong>
              <small>Desligue para receber somente Web Push, sem criar histórico no banco.</small>
            </span>
            <input
              type="checkbox"
              checked={storeSiteVisits}
              disabled={saving}
              onChange={(event) => void save(siteVisitsEnabled, event.target.checked)}
            />
          </label>
          <p className="admin-notification-settings-note" role="status">{message || (siteVisitsEnabled ? "Monitor ativo para novos carregamentos do site." : "Monitor inativo.")}</p>
        </div>
        <div>
          <p className="admin-notification-settings-kicker">Cadastro de contas</p>
          <div className="admin-webhook-status">
            <span className={webhookConfigured ? "is-ready" : "is-missing"} aria-hidden />
            <div>
              <strong>{webhookConfigured ? "Segredo do webhook configurado" : "Falta configurar o segredo do webhook"}</strong>
              <small>Evento Clerk: <code>user.created</code></small>
            </div>
          </div>
          <p className="admin-notification-settings-help">
            Cadastre <code>/api/webhooks/clerk</code> no Clerk e assine o evento de criação de usuário. A assinatura da requisição é validada antes de gerar a notificação.
          </p>
        </div>
      </div>
    </section>
  )
}
