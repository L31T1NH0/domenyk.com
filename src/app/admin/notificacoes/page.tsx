import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"
import { getAdminUserId } from "@/lib/auth"
import { listAdminPushSubscriptions, listPushCampaigns, pushSubscriptionCounts } from "@/lib/db/push-subscriptions"
import { getNotes } from "@/lib/db/notes"
import { getPosts } from "@/lib/db/posts"
import { descriptionFromMarkdown, noteDisplayTitle } from "@/lib/seo"
import { ManualPushComposer, type PushContentOption } from "./ManualPushComposer"
import { AdminPushDevices, type AdminPushDevice } from "./AdminPushDevices"
import { AdminCommandHeader } from "../AdminCommandHeader"

function deviceLabel(userAgent?: string) {
  if (!userAgent) return "Dispositivo não identificado"
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /Firefox\//.test(userAgent) ? "Firefox"
      : /CriOS\//.test(userAgent) ? "Chrome"
        : /Chrome\//.test(userAgent) ? "Chrome/Brave"
          : /Safari\//.test(userAgent) ? "Safari"
            : "Navegador"
  const system = /Android/.test(userAgent) ? "Android"
    : /iPhone/.test(userAgent) ? "iPhone"
      : /iPad/.test(userAgent) ? "iPad"
        : /Windows/.test(userAgent) ? "Windows"
          : /Mac OS X/.test(userAgent) ? "macOS"
            : /Linux/.test(userAgent) ? "Linux"
              : "sistema desconhecido"
  return `${browser} · ${system}`
}

export default async function AdminPushPage() {
  const adminId = getAdminUserId()
  const [{ posts }, { notes }, counts, campaigns, storedDevices] = await Promise.all([
    getPosts({ limit: 200 }),
    getNotes({ limit: 200 }),
    pushSubscriptionCounts(),
    listPushCampaigns(),
    adminId ? listAdminPushSubscriptions(adminId) : Promise.resolve([]),
  ])
  const devices: AdminPushDevice[] = storedDevices.map((device) => ({
    id: device._id.toString(),
    label: deviceLabel(device.userAgent),
    updatedAt: device.updatedAt.toISOString(),
    ...(device.lastSuccessAt ? { lastSuccessAt: device.lastSuccessAt.toISOString() } : {}),
  }))
  const content: PushContentOption[] = [
    ...posts.map((post) => ({
      id: post._id.toString(),
      type: "post" as const,
      title: post.title,
      description: post.excerpt?.trim() || `Leia “${post.title}” no domenyk.com.`,
      href: `/posts/${post.slug}`,
    })),
    ...notes.map((note) => ({
      id: note._id.toString(),
      type: "note" as const,
      title: noteDisplayTitle(note),
      description: note.seoDescription?.trim() || descriptionFromMarkdown(note.content, 180),
      href: `/notes/${note._id.toString()}`,
    })),
  ]

  return (
    <>
      <AdminCommandHeader title="Notificações push" description="Assinaturas, alertas privados e disparos editoriais." />
      <section className="admin-push-summary" aria-label="Resumo das assinaturas">
        {[
          ["Dispositivos", counts.devices],
          ["Inscritos em posts", counts.posts],
          ["Inscritos em notas", counts.notes],
          ["Seus dispositivos", counts.adminDevices],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>

      <ManualPushComposer content={content} />

      <div className="admin-notification-grid">
        <div className="admin-notification-devices">
          <section className="admin-workspace-panel">
            <header className="admin-workspace-header"><div><h2>Este dispositivo</h2><p>Alertas administrativos e publicações</p></div></header>
            <div className="admin-block-body"><PushSubscriptionManager showAdminEvents /></div>
          </section>

          <section className="admin-workspace-panel">
            <header className="admin-workspace-header"><div><h2>Dispositivos administrativos</h2><p>Revogue o acesso privado de aparelhos que você não usa mais</p></div></header>
            <AdminPushDevices devices={devices} />
          </section>
        </div>

        <section className="admin-workspace-panel admin-notification-history">
          <header className="admin-workspace-header"><div><h2>Disparos recentes</h2><p>{campaigns.length} registros</p></div></header>
          {campaigns.length === 0 ? <p className="admin-empty">Nenhuma notificação enviada ainda.</p> : campaigns.map((campaign) => (
            <div key={campaign._id.toString()} className="admin-push-campaign">
              <div><strong>{campaign.title}</strong><span>{campaign.source === "manual" ? "Manual" : "Automático"} · {campaign.topic === "posts" ? "Posts" : "Notas"}</span></div>
              <div><span>{campaign.sentCount} enviados · {campaign.failedCount} falhas</span><time>{campaign.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" })}</time></div>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
