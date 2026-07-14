import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"
import { getAdminUserId } from "@/lib/auth"
import { listAdminPushSubscriptions, listPushCampaigns, pushSubscriptionCounts } from "@/lib/db/push-subscriptions"
import { getNotes } from "@/lib/db/notes"
import { getPosts } from "@/lib/db/posts"
import { descriptionFromMarkdown, noteDisplayTitle } from "@/lib/seo"
import { ManualPushComposer, type PushContentOption } from "./ManualPushComposer"
import { AdminPushDevices, type AdminPushDevice } from "./AdminPushDevices"

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
      <header className="admin-page-header"><div><h1>Notificações push</h1><p>Assinaturas, alertas privados e disparos editoriais.</p></div></header>
      <section className="admin-metrics">
        {[
          ["Dispositivos", counts.devices],
          ["Inscritos em posts", counts.posts],
          ["Inscritos em notas", counts.notes],
          ["Seus dispositivos", counts.adminDevices],
        ].map(([label, value]) => <div key={label} className="admin-metric"><span>{label}</span><strong>{value}</strong></div>)}
      </section>

      <div className="mt-5"><ManualPushComposer content={content} /></div>

      <section className="admin-list mt-5">
        <header className="admin-list-header"><div><strong>Este dispositivo</strong><small>Alertas administrativos e publicações</small></div></header>
        <div className="p-4 lg:p-5"><PushSubscriptionManager showAdminEvents /></div>
      </section>

      <section className="admin-list mt-5">
        <header className="admin-list-header"><div><strong>Dispositivos administrativos</strong><small>Revogue o acesso privado de aparelhos que você não usa mais</small></div></header>
        <AdminPushDevices devices={devices} />
      </section>

      <section className="admin-list mt-5">
        <header className="admin-list-header"><div><strong>Disparos recentes</strong><small>{campaigns.length} registros</small></div></header>
        {campaigns.length === 0 ? <p className="admin-empty">Nenhuma notificação enviada ainda.</p> : campaigns.map((campaign) => (
          <div key={campaign._id.toString()} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 text-[11px] last:border-b-0 dark:border-neutral-800">
            <div className="min-w-0"><strong className="block truncate text-neutral-900 dark:text-neutral-100">{campaign.title}</strong><span className="mt-1 block text-neutral-500">{campaign.source === "manual" ? "Manual" : "Automático"} · {campaign.topic === "posts" ? "Posts" : "Notas"}</span></div>
            <div className="flex items-center gap-4 text-neutral-500"><span>{campaign.sentCount} enviados · {campaign.failedCount} falhas</span><time>{campaign.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" })}</time></div>
          </div>
        ))}
      </section>
    </>
  )
}
