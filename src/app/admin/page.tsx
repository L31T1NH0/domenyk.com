import Link from "next/link"
import { getPosts } from "@/lib/db/posts"
import { getActivityDashboard } from "@/lib/db/activity"
import { ActivityChart } from "./ActivityChart"

export default async function AdminDashboard() {
  const [{ total }, activity] = await Promise.all([getPosts({ includeUnpublished: true }), getActivityDashboard(14)])
  const metrics = [
    { label: "Visualizações", value: activity.totals.views, detail: "últimos 14 dias" },
    { label: "Visitantes", value: activity.totals.visitors, detail: "identidades únicas" },
    { label: "Comentários", value: activity.totals.comments, detail: "no período" },
    { label: "Posts", value: total, detail: "publicados e rascunhos" },
  ]

  return <>
    <header className="admin-page-header">
      <div><h1>Visão geral</h1><p>Acompanhe leitura, conversa e conteúdo em um só lugar.</p></div>
      <Link href="/admin/posts/new" className="admin-button-primary">Novo post</Link>
    </header>

    <section className="admin-metrics" aria-label="Indicadores">
      {metrics.map((metric) => <div key={metric.label} className="admin-metric"><span>{metric.label}</span><strong>{metric.value.toLocaleString("pt-BR")}</strong><small>{metric.detail}</small></div>)}
    </section>

    <div className="admin-dashboard-grid">
      <section className="admin-panel admin-activity-panel">
        <header><div><h2>Atividade</h2><p>Visualizações e comentários por dia</p></div><div className="admin-chart-legend"><span>Views</span><span>Comentários</span></div></header>
        <ActivityChart days={activity.days} />
      </section>

      <section className="admin-panel">
        <header><div><h2>Posts em destaque</h2><p>Mais lidos no período</p></div></header>
        <div className="admin-ranked-list">
          {activity.topPosts.map((post, index) => <Link href={`/posts/${post.slug}`} key={post.publicId}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{post.title}</strong><small>{post.views} views, {post.comments} comentários</small></div></Link>)}
          {activity.topPosts.length === 0 && <p className="admin-empty">Os primeiros eventos aparecerão aqui.</p>}
        </div>
      </section>
    </div>

    <section className="admin-panel">
      <header><div><h2>Registro recente</h2><p>O que aconteceu no site, com data e hora</p></div><span className="admin-auth-summary">{activity.totals.authenticated} ações autenticadas</span></header>
      <div className="admin-event-list">
        {activity.recent.map((event) => <div key={event.id} className="admin-event-row"><span className={`admin-event-icon ${event.type}`} aria-hidden>{event.type === "post_view" ? "V" : "C"}</span><div><strong>{event.type === "post_view" ? "Post visitado" : "Novo comentário"}</strong><p>{event.postTitle ?? "Conteúdo removido"}</p></div><span className="admin-event-identity">{event.isAuthenticated ? event.userName ?? "Usuário logado" : "Visitante anônimo"}</span><time>{new Date(event.occurredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" })}</time></div>)}
        {activity.recent.length === 0 && <p className="admin-empty">Ainda não há atividade registrada na nova tabela.</p>}
      </div>
    </section>
  </>
}
