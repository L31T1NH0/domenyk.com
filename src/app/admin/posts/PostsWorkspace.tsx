"use client"

import type { SerializedPostSummary } from "@/lib/db/posts"
import { formatSiteDate } from "@/lib/datetime"
import { usePostsTable, translationStatuses } from "./usePostsTable"
import { Button, Check, DeleteButton, Disclosure, Feedback, HStack, Input, Link, PageHeader, Table, TableRegion, Text, VStack } from "../_components/ui"
import { Selector } from "@astryxdesign/core/Selector"
import { pixel, proportional, type TableColumn } from "@astryxdesign/core/Table"

export function PostsWorkspace({ posts }: { posts: SerializedPostSummary[] }) {
  const s = usePostsTable({ posts })
  const columns: TableColumn<SerializedPostSummary>[] = [
    { key: "selection", width: pixel(48), header: <Check label="Selecionar resultados" isLabelHidden value={s.allFilteredSelected ? true : s.selectedIds.length ? "indeterminate" : false} onChange={s.toggleFilteredSelection} />,
      renderCell: post => <Check label={`Selecionar ${post.title}`} isLabelHidden value={s.selected[post._id] === true} onChange={checked => s.setPostSelected(post._id, checked)} /> },
    { key: "title", width: proportional(3), header: "Post", renderCell: post => <VStack gap={1}>
      <Link href={`/admin/posts/${post._id}`}>{post.title}</Link>
      <Text type="supporting">{post.pinned ? "Fixado. " : ""}{post.hiddenFromTimeline ? "Fora da timeline. " : ""}{post.series ? `Capítulo ${post.series.position}` : post.slug}</Text>
      <Disclosure title="Idiomas">{translationStatuses(post).map(version => <Text key={version.locale} type="supporting">{version.locale.toUpperCase()}: {version.exists ? version.published ? "Publicado" : "Rascunho" : "Sem tradução"}{version.stale ? "; revisar tradução" : ""}</Text>)}</Disclosure>
    </VStack> },
  ]
  if (s.visibleColumns.status) columns.push({ key: "status", header: "Estado", renderCell: post => <Text type="supporting">{post.published ? "Publicado" : "Rascunho"}</Text> })
  if (s.visibleColumns.date) columns.push({ key: "date", header: "Data", renderCell: post => <Text type="supporting">{post.publishedAt || post.createdAt ? formatSiteDate(post.publishedAt ?? post.createdAt, { dateStyle: "short" }) : "Sem data"}</Text> })
  if (s.visibleColumns.views) columns.push({ key: "views", header: "Leituras", align: "end", renderCell: post => post.views ?? 0 })
  if (s.visibleColumns.reading) columns.push({ key: "reading", header: "Tempo", renderCell: post => `${post.readingTimeMinutes} min` })
  if (s.visibleColumns.style) columns.push({ key: "style", header: "Estilo" })
  columns.push({ key: "actions", header: "Ações", renderCell: post => <Disclosure title="Gerenciar">
    <Button label="Editar" href={`/admin/posts/${post._id}/edit`} size="sm" />
    <Button label={post.published ? "Despublicar" : "Publicar"} size="sm" clickAction={() => s.togglePostBoolean(post._id, "published", post.published)} />
    <Button label={post.pinned ? "Desafixar" : "Fixar"} size="sm" clickAction={() => s.togglePostBoolean(post._id, "pinned", post.pinned)} />
    <DeleteButton title={`Excluir “${post.title}”?`} description="O post e seus comentários serão excluídos." onDelete={() => s.remove([post._id])} />
  </Disclosure> })
  return <VStack gap={6}>
    <PageHeader title="Posts" description={`${s.posts.length} textos no seu acervo.`} actions={<Button label="Escrever post" variant="primary" href="/admin/posts/new" />} />
    <HStack wrap="wrap" gap={3} vAlign="end">
      <Input label="Buscar posts" value={s.query} onChange={s.setQuery} type="search" hasClear />
      <Selector label="Publicação" value={s.status} onChange={value => s.setStatus(value as typeof s.status)} options={[{ value: "all", label: "Todos" }, { value: "published", label: "Publicados" }, { value: "draft", label: "Rascunhos" }]} />
      <Selector label="Timeline" value={s.visibility} onChange={value => s.setVisibility(value as typeof s.visibility)} options={[{ value: "all", label: "Todos" }, { value: "timeline", label: "Visíveis" }, { value: "hidden", label: "Ocultos" }]} />
      <Button label="Exportar" isDisabled={!s.actionIds.length} isLoading={s.busyAction === "download"} onClick={() => void s.download(s.actionIds)} />
    </HStack>
    <Disclosure title="Colunas da lista"><HStack gap={4} wrap="wrap">{([ ["status", "Estado"], ["date", "Data"], ["views", "Leituras"], ["reading", "Tempo"], ["style", "Estilo"] ] as const).map(([key, label]) => <Check key={key} label={label} value={s.visibleColumns[key]} onChange={checked => s.setVisibleColumns(current => ({ ...current, [key]: checked }))} />)}</HStack></Disclosure>
    <Feedback error={s.actionError} />
    {s.selectedIds.length > 0 && <HStack wrap="wrap" gap={3}>
      <Text>{s.selectedIds.length} selecionados</Text>
      <Button label="Ocultar da timeline" isLoading={s.busyAction === "hide"} onClick={() => void s.hideFromTimeline(s.selectedIds)} />
      <Button label="Exportar seleção" onClick={() => void s.download(s.selectedIds)} />
      <DeleteButton title="Excluir posts selecionados?" description="Os posts e seus comentários serão excluídos permanentemente." onDelete={() => s.remove(s.selectedIds)} disabled={Boolean(s.busyAction)} />
    </HStack>}
    <TableRegion label="Acervo de posts"><Table data={s.filteredPosts} idKey="_id" columns={columns} hasHover emptyState={<Text>Nenhum post encontrado. Ajuste a busca ou escreva um novo texto.</Text>} /></TableRegion>
  </VStack>
}
