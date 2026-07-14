import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"
import { listPushCampaigns, pushSubscriptionCounts } from "@/lib/db/push-subscriptions"
import { getNotes } from "@/lib/db/notes"
import { getPosts } from "@/lib/db/posts"
import { descriptionFromMarkdown, noteDisplayTitle } from "@/lib/seo"
import { ManualPushComposer, type PushContentOption } from "./ManualPushComposer"

export default async function AdminPushPage() {
  const [{ posts }, { notes }, counts, campaigns] = await Promise.all([
    getPosts({ limit: 200 }),
    getNotes({ limit: 200 }),
    pushSubscriptionCounts(),
    listPushCampaigns(),
  ])
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
