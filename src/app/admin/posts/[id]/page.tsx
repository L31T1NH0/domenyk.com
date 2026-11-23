import { loadAdminPostPage, date } from "./data"
import { Button, Disclosure, Facts, HStack, Link, PageHeader, Panel, Text, VStack } from "../../_components/ui"
export const metadata = { title: "Detalhes do post" }
export default async function AdminPostPage(props: Parameters<typeof loadAdminPostPage>[0]) {
  const { id, post, themes, summary, seoReady, indexable } = await loadAdminPostPage(props)
  return <VStack gap={8}>
    <PageHeader title={post.title} description={summary} back={<Link href="/admin/posts">Voltar para posts</Link>}
      actions={<><Button label="Editar post" variant="primary" href={`/admin/posts/${id}/edit`} />{post.published && <Button label="Ver no site" href={`/posts/${post.slug}`} target="_blank" />}</>} />
    <Facts items={[["Estado", post.published ? "Publicado" : "Rascunho"], ["Leituras", post.views ?? 0], ["Tempo de leitura", `${post.readingTimeMinutes} min`], ["Endereço", post.slug]]} />
    <Panel title="Publicação"><Facts items={[["Timeline", post.hiddenFromTimeline ? "Oculto" : "Visível"], ["Fixado", post.pinned ? "Sim" : "Não"], ["Comentários por parágrafo", post.paragraphCommentsEnabled ? "Ativos" : "Inativos"], ["Estilo", post.style]]} /></Panel>
    <Panel title="Busca"><Text>{!indexable ? "Este post está fora da indexação." : seoReady ? "Título e descrição SEO preenchidos." : "Título ou descrição SEO precisam de revisão."}</Text><Link href={`/admin/posts/${id}/edit`}>Editar dados de busca</Link></Panel>
    <Panel title="Temas"><HStack wrap="wrap" gap={3}>{themes.map(theme => <Link key={theme._id.toString()} href={`/admin/temas/${theme._id.toString()}`}>{theme.name}</Link>)}</HStack>{!themes.length && <Text color="secondary">Nenhum tema associado.</Text>}</Panel>
    <Disclosure title="Datas e histórico"><Facts items={[["Criado", date(post.createdAt)], ["Atualizado", date(post.updatedAt)], ["Publicado", post.publishedAt ? date(post.publishedAt) : "Ainda não publicado"]]} /></Disclosure>
  </VStack>
}
