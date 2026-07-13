import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowTopRightOnSquareIcon, PencilSquareIcon } from "@heroicons/react/24/outline"
import { getPostById } from "@/lib/db/posts"
import { getThemesForPost } from "@/lib/db/themes"
import { descriptionFromMarkdown } from "@/lib/seo"

function date(value: Date) {
  return format(value, "d 'de' MMM. 'de' yyyy, HH:mm", { locale: ptBR })
}

export default async function AdminPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()
  const themes = await getThemesForPost(post._id)
  const summary = post.excerpt || post.subtitle || descriptionFromMarkdown(post.content)
  const seoReady = Boolean(post.title.trim() && summary.trim())

  return <>
    <header className="admin-resource-header">
      <div><p><Link href="/admin/posts">Posts</Link> / {post.title}</p><h1>{post.title}</h1></div>
      <div className="admin-resource-actions">
        {post.published && <Link className="admin-button-secondary" href={`/posts/${post.slug}`} target="_blank"><ArrowTopRightOnSquareIcon /> Ver no site</Link>}
        <Link className="admin-button-secondary" href={`/admin/posts/${id}/edit`}><PencilSquareIcon /> Editar texto</Link>
      </div>
    </header>
    <div className="admin-resource-layout">
      <main className="admin-resource-main">
        <section className="admin-resource-summary">
          <span className={`admin-status ${post.published ? "is-positive" : "is-warning"}`}>{post.published ? "Publicado" : "Rascunho"}</span>
          <dl>
            <div><dt>Slug</dt><dd>{post.slug}</dd></div>
            <div><dt>Publicado em</dt><dd>{post.publishedAt ? date(post.publishedAt) : "Ainda não publicado"}</dd></div>
            <div><dt>Atualizado em</dt><dd>{date(post.updatedAt)}</dd></div>
            <div><dt>Leitura</dt><dd>{post.readingTimeMinutes} min</dd></div>
            <div><dt>Resumo</dt><dd>{summary || "Sem resumo definido."}</dd></div>
          </dl>
        </section>
        <section className="admin-section admin-activity">
          <header><div><h2>Histórico essencial</h2><p>Eventos derivados do estado atual do post.</p></div></header>
          <ol>
            <li><span className="admin-activity-dot" /><div><strong>Conteúdo atualizado</strong><time>{date(post.updatedAt)}</time></div></li>
            {post.publishedAt && <li><span className="admin-activity-dot is-positive" /><div><strong>Publicado</strong><time>{date(post.publishedAt)}</time></div></li>}
            <li><span className="admin-activity-dot" /><div><strong>Post criado</strong><time>{date(post.createdAt)}</time></div></li>
          </ol>
        </section>
      </main>
      <aside className="admin-inspector">
        <section><header><h2>Publicação</h2></header><dl className="admin-inspector-list"><div><dt>Status</dt><dd>{post.published ? "Publicado" : "Rascunho"}</dd></div><div><dt>Fixado</dt><dd>{post.pinned ? "Sim" : "Não"}</dd></div><div><dt>Estilo</dt><dd>{post.style}</dd></div></dl></section>
        <section><header><h2>SEO</h2><span className={`admin-status ${seoReady ? "is-positive" : "is-warning"}`}>{seoReady ? "Pronto" : "Revisar"}</span></header><p className="admin-inspector-copy">{seoReady ? "Título e descrição estão disponíveis para os buscadores." : "Adicione um resumo ou subtítulo para uma descrição mais precisa."}</p><Link className="admin-button-secondary admin-inspector-action" href={`/admin/posts/${id}/edit`}>Editar conteúdo</Link></section>
        <section><header><h2>Temas relacionados</h2></header><div className="admin-chip-list">{themes.map((theme) => <Link key={theme._id.toString()} href={`/admin/temas/${theme._id.toString()}`}>{theme.name}</Link>)}{themes.length === 0 && <p className="admin-inspector-copy">Este post ainda não pertence a um tema curado.</p>}</div><Link className="admin-text-link" href="/admin/temas">Gerenciar temas</Link></section>
        <section><header><h2>Visibilidade</h2></header><dl className="admin-inspector-list"><div><dt>Timeline</dt><dd>{post.hiddenFromTimeline ? "Oculto" : "Visível"}</dd></div><div><dt>Comentários por parágrafo</dt><dd>{post.paragraphCommentsEnabled ? "Ativos" : "Inativos"}</dd></div><div><dt>Visualizações</dt><dd>{post.views ?? 0}</dd></div></dl></section>
      </aside>
    </div>
  </>
}
