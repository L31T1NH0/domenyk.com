import Link from "next/link"
import { ArrowUpRightIcon } from "@heroicons/react/24/outline"
import { getPosts } from "@/lib/db/posts"
import { getActivityDashboard } from "@/lib/db/activity"
import { ActivityChart } from "./ActivityChart"
import { AdminCommandHeader } from "./AdminCommandHeader"

export default async function AdminDashboard() {
  const [{ total }, activity] = await Promise.all([getPosts({ includeUnpublished: true }), getActivityDashboard(14)])
  return <>
    <AdminCommandHeader
      title="Visão geral"
      description="Leitura, conversa e publicação nos últimos 14 dias."
      actions={<Link href="/admin/posts/new" className="admin-button-primary">Novo post</Link>}
    />

    <section className="admin-overview-focus" aria-label="Desempenho editorial">
      <div className="admin-overview-chart">
        <header className="admin-workspace-header">
          <div><h2>Leitura no período</h2><p>Visualizações e comentários por dia</p></div>
          <div className="admin-chart-legend"><span>Views</span><span>Comentários</span></div>
        </header>
        <div className="admin-overview-total"><span>Visualizações</span><strong>{activity.totals.views.toLocaleString("pt-BR")}</strong><small>nos últimos 14 dias</small></div>
        <ActivityChart days={activity.days} />
      </div>
      <dl className="admin-overview-facts">
        <div><dt>Visitantes</dt><dd>{activity.totals.visitors.toLocaleString("pt-BR")}</dd><small>identidades únicas</small></div>
        <div><dt>Comentários</dt><dd>{activity.totals.comments.toLocaleString("pt-BR")}</dd><small>no período</small></div>
        <div><dt>Posts</dt><dd>{total.toLocaleString("pt-BR")}</dd><small>publicados e rascunhos</small></div>
        <div><dt>Ações autenticadas</dt><dd>{activity.totals.authenticated.toLocaleString("pt-BR")}</dd><small>no registro recente</small></div>
      </dl>
    </section>

    <div className="admin-overview-grid">
      <section className="admin-workspace-panel">
        <header className="admin-workspace-header"><div><h2>Mais lidos</h2><p>Posts com maior alcance no período</p></div></header>
        <ol className="admin-overview-ranking">
          {activity.topPosts.map((post, index) => <li key={post.publicId}><Link href={`/posts/${post.slug}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{post.title}</strong><small>{post.views} views, {post.comments} comentários</small></div><ArrowUpRightIcon aria-hidden /></Link></li>)}
          {activity.topPosts.length === 0 && <li className="admin-empty">Os primeiros eventos aparecerão aqui.</li>}
        </ol>
      </section>

      <section className="admin-workspace-panel admin-overview-log">
        <header className="admin-workspace-header"><div><h2>Registro recente</h2><p>Atividade com data, origem e identidade</p></div></header>
        <div className="admin-overview-events">
          {activity.recent.map((event) => <div key={event.id} className="admin-overview-event"><span className={`admin-event-icon ${event.type}`} aria-hidden>{event.type === "post_view" ? "V" : "C"}</span><div><strong>{event.type === "post_view" ? "Post visitado" : "Novo comentário"}</strong><p>{event.postTitle ?? "Conteúdo removido"}</p></div><span>{event.isAuthenticated ? event.userName ?? "Usuário logado" : "Visitante anônimo"}</span><time>{new Date(event.occurredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" })}</time></div>)}
          {activity.recent.length === 0 && <p className="admin-empty">Ainda não há atividade registrada na nova tabela.</p>}
        </div>
      </section>
    </div>
  </>
}
