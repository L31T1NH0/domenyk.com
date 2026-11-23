"use client"

import { useCommentsTable } from "./useCommentsTable"
import { formatSiteDate } from "@/lib/datetime"
import { Avatar, Button, DeleteButton, Empty, Feedback, HStack, Input, Link, PageHeader, Select, Table, TableRegion, Text, VStack } from "../_components/ui"

export function CommentsWorkspace(props: Parameters<typeof useCommentsTable>[0]) {
  const s = useCommentsTable(props)
  return <VStack gap={6}>
    <PageHeader title="Comentários" description="Acompanhe a conversa em torno dos seus textos." />
    <HStack wrap="wrap" gap={3} vAlign="end"><Input label="Buscar comentário ou autor" type="search" value={s.query} onChange={s.setQuery} hasClear />
      <Select label="Conteúdo" value={s.filter} onChange={value => s.setFilter(value as typeof s.filter)} options={[{ value: "all", label: "Posts e notas" }, { value: "post", label: "Posts" }, { value: "note", label: "Notas" }]} /></HStack>
    <Feedback error={s.error} />
    <VStack as="ul" gap={6}>{s.filtered.map(comment => {
      const href = comment.parent.publicHref ? `${comment.parent.publicHref}${comment.paragraphId ? `#${comment.paragraphId}` : ""}` : null
      return <VStack as="li" key={comment._id} gap={3} paddingBlock={3}>
        <HStack gap={3}><Avatar name={comment.authorName} src={comment.authorImageUrl || undefined} size="sm" /><Text weight="medium">{comment.authorName}</Text><Text type="supporting">{formatSiteDate(comment.createdAt, { dateStyle: "short" })}</Text></HStack>
        <article className="note-content comment-content" dangerouslySetInnerHTML={{ __html: comment.contentHtml }} />
        <HStack gap={3} wrap="wrap">{comment.parent.adminHref && <Link href={comment.parent.adminHref}>{comment.parent.title}</Link>}{comment.paragraphId && <Text type="supporting">Comentário em um trecho</Text>}</HStack>
        <HStack gap={2} wrap="wrap">{href && <Button label="Abrir conversa" href={href} target="_blank" size="sm" />}<Button label={s.detailId === comment._id ? "Fechar detalhes" : "Ver detalhes"} size="sm" variant="ghost" onClick={() => void s.toggleDetails(comment._id)} /><DeleteButton title="Excluir este comentário?" onDelete={() => s.remove(comment._id)} /></HStack>
        {s.detailId === comment._id && <>
          <Feedback error={s.detailError} />
          {s.detailLoading && <Text color="secondary">Carregando detalhes…</Text>}
          {s.detailRecord && <TableRegion label="Detalhes do comentário"><Table data={Object.entries(s.detailRecord).map(([field, value]) => ({ field, type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value, value: s.detailValue(value) }))} idKey="field" columns={[{ key: "field", header: "Campo" }, { key: "type", header: "Tipo" }, { key: "value", header: "Valor", renderCell: row => <pre className="whitespace-pre-wrap break-words"><Text type="code">{row.value}</Text></pre> }]} /></TableRegion>}
        </>}
      </VStack>
    })}</VStack>
    {!s.filtered.length && <Empty>Nenhum comentário encontrado.</Empty>}
  </VStack>
}
