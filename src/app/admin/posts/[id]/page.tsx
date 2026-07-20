import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowTopRightOnSquareIcon, PencilSquareIcon } from "@heroicons/react/24/outline"
import { getPostById } from "@/lib/db/posts"
import { getThemesForPost } from "@/lib/db/themes"
import { descriptionFromMarkdown } from "@/lib/seo"
import { AdminCommandHeader } from "../../AdminCommandHeader"
import { formatSiteDate } from "@/lib/datetime"

function date(value: Date) {
  return formatSiteDate(value, { dateStyle: "long", timeStyle: "short", hourCycle: "h23" })
}

export default async function AdminPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()
  const themes = await getThemesForPost(post._id)
  const summary = post.excerpt || post.subtitle || descriptionFromMarkdown(post.content)
  const seoReady = Boolean(post.seoTitle?.trim() && post.seoDescription?.trim())
  const indexable = post.published && post.hiddenFromTimeline !== true

  return <>
    <AdminCommandHeader
      title={post.title}
      description={summary || "Sem resumo definido."}
      back={{ href: "/admin/posts", label: "Posts" }}
      actions={<>
        {post.published && <Link className="admin-button-secondary" href={`/posts/${post.slug}`} target="_blank"><ArrowTopRightOnSquareIcon /> Ver no site</Link>}
        <Link className="admin-button-secondary" href={`/admin/posts/${id}/edit`}><PencilSquareIcon /> Editar texto</Link>
      </>}
    />

    <article className="admin-detail-sheet">
      <dl className="admin-detail-strip">
        <div><dt>Status</dt><dd><span className={`admin-record-status ${post.published ? "is-live" : "is-review"}`}>{post.published ? "Publicado" : "Rascunho"}</span></dd></div>
        <div><dt>Visualizações</dt><dd>{post.views ?? 0}</dd></div>
        <div><dt>Leitura</dt><dd>{post.readingTimeMinutes} min</dd></div>
        <div><dt>Estilo</dt><dd>{post.style}</dd></div>
      </dl>

      <div className="admin-detail-grid">
        <div className="admin-detail-primary">
          <section className="admin-detail-section"><header><h2>Registro editorial</h2><p>Identidade e datas do texto.</p></header><dl className="admin-detail-facts"><div><dt>Slug</dt><dd>{post.slug}</dd></div><div><dt>Publicado em</dt><dd>{post.publishedAt ? date(post.publishedAt) : "Ainda não publicado"}</dd></div><div><dt>Atualizado em</dt><dd>{date(post.updatedAt)}</dd></div><div><dt>Resumo</dt><dd>{summary || "Sem resumo definido."}</dd></div></dl></section>

          <section className="admin-detail-section admin-detail-history"><header><h2>Histórico essencial</h2><p>Eventos derivados do estado atual do post.</p></header><ol><li><span /><div><strong>Conteúdo atualizado</strong><time>{date(post.updatedAt)}</time></div></li>{post.publishedAt && <li><span className="is-live" /><div><strong>Publicado</strong><time>{date(post.publishedAt)}</time></div></li>}<li><span /><div><strong>Post criado</strong><time>{date(post.createdAt)}</time></div></li></ol></section>
        </div>

        <aside className="admin-detail-secondary">
          <section><header><h2>Publicação</h2></header><dl><div><dt>Fixado</dt><dd>{post.pinned ? "Sim" : "Não"}</dd></div><div><dt>Timeline</dt><dd>{post.hiddenFromTimeline ? "Oculto" : "Visível"}</dd></div><div><dt>Comentários por parágrafo</dt><dd>{post.paragraphCommentsEnabled ? "Ativos" : "Inativos"}</dd></div></dl></section>
          <section><header><h2>SEO</h2><span className={`admin-record-status ${seoReady && indexable ? "is-live" : "is-review"}`}>{indexable ? (seoReady ? "Pronto" : "Revisar") : "Noindex"}</span></header><p>{!indexable ? "Este post não será indexado porque está em rascunho ou oculto da timeline." : seoReady ? "Título e descrição SEO independentes estão disponíveis para os buscadores." : "Preencha o título SEO e a descrição SEO; os campos editoriais continuam preservados como fallback."}</p><Link className="admin-inline-action" href={`/admin/posts/${id}/edit`}>Editar conteúdo</Link></section>
          <section><header><h2>Temas relacionados</h2></header><div className="admin-detail-topics">{themes.map((theme) => <Link key={theme._id.toString()} href={`/admin/temas/${theme._id.toString()}`}>{theme.name}</Link>)}{themes.length === 0 && <p>Este post ainda não pertence a um tema curado.</p>}</div><Link className="admin-inline-action" href="/admin/temas">Gerenciar temas</Link></section>
        </aside>
      </div>
    </article>
  </>
}
