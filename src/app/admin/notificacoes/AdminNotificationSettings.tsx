"use client"

import { useState } from "react"

export function AdminNotificationSettings({
  initialPushSiteVisits,
  initialStoreSiteVisits,
  webhookConfigured,
}: {
  initialPushSiteVisits: boolean
  initialStoreSiteVisits: boolean
  webhookConfigured: boolean
}) {
  const [pushSiteVisits, setPushSiteVisits] = useState(initialPushSiteVisits)
  const [storeSiteVisits, setStoreSiteVisits] = useState(initialStoreSiteVisits)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function save(nextPush: boolean, nextStore: boolean) {
    const previousPush = pushSiteVisits
    const previousStore = storeSiteVisits
    setPushSiteVisits(nextPush)
    setStoreSiteVisits(nextStore)
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pushSiteVisits: nextPush,
          storeSiteVisits: nextStore,
        }),
      })
      const data = await response.json().catch(() => null) as {
        error?: string
        pushSiteVisits?: boolean
        storeSiteVisits?: boolean
      } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar as configurações.")
      setPushSiteVisits(data?.pushSiteVisits === true)
      setStoreSiteVisits(data?.storeSiteVisits === true)
      setMessage("Configuração salva.")
    } catch (error) {
      setPushSiteVisits(previousPush)
      setStoreSiteVisits(previousStore)
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as configurações.")
    } finally {
      setSaving(false)
    }
  }

  const visitStatus = storeSiteVisits
    ? pushSiteVisits
      ? "Histórico e Web Push ativos."
      : "Histórico ativo; Web Push desligado."
    : pushSiteVisits
      ? "Somente Web Push ativo; nenhuma visita é salva na central."
      : "Monitor de visitas desligado."
  const deduplicationStatus = storeSiteVisits || pushSiteVisits
    ? " A mesma pessoa na mesma página é ignorada por 1 hora."
    : ""

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
          <h3 className="admin-notification-settings-title">Visitas ao site</h3>
          <label className="admin-toggle-row">
            <span>
              <strong>Salvar na central de notificações</strong>
              <small>Cria um histórico no banco mesmo quando o Web Push está desligado.</small>
            </span>
            <input
              type="checkbox"
              checked={storeSiteVisits}
              disabled={saving}
              onChange={(event) => void save(pushSiteVisits, event.target.checked)}
            />
          </label>
          <label className="admin-toggle-row">
            <span>
              <strong>Enviar também por Web Push</strong>
              <small>Envia aos dispositivos que ativaram “Qualquer visita ao site”.</small>
            </span>
            <input
              type="checkbox"
              checked={pushSiteVisits}
              disabled={saving}
              onChange={(event) => void save(event.target.checked, storeSiteVisits)}
            />
          </label>
          <p className="admin-notification-settings-note" role="status">
            {message ? `${message} ${visitStatus}${deduplicationStatus}` : `${visitStatus}${deduplicationStatus}`}
          </p>
        </div>
        <div>
          <h3 className="admin-notification-settings-title">Cadastro de contas</h3>
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
