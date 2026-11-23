"use client"

import type { useAdminNotesTable } from "./useAdminNotesTable"
import { useAdminNotesTable as useNotes } from "./useAdminNotesTable"
import { useEditorialImport, actionLabel, statusLabel } from "./useEditorialImport"
import { useSeoImport } from "./useSeoImport"
import { Button, Disclosure, Feedback, FilePicker, HStack, Input, Link, PageHeader, Table, TableRegion, Text, VStack } from "../_components/ui"
import { formatSiteDate } from "@/lib/datetime"

function EditorialImportForm() {
  const { inputRef, ...s } = useEditorialImport()
  return <VStack gap={4}>
    <Text color="secondary">Carregue o pacote de revisão. Confira as alterações antes de aplicá-las.</Text>
    <FilePicker label="Escolher pacote editorial" accept=".json,application/json" onFile={s.inspectFile} busy={s.busy} inputRef={inputRef} />
    {s.fileName && <Text type="supporting">{s.fileName}</Text>}
    <Feedback error={s.error} message={s.message} />
    {s.preview && <>
      <Text>{s.preview.counts.update} para atualizar, {s.preview.counts.archive} para excluir, {s.preview.counts.unchanged} sem mudanças.</Text>
      <TableRegion label="Revisão editorial"><Table data={s.preview.items} idKey={item => `${item.editorialId}:${item.position}`} columns={[
        { key: "title", header: "Nota" }, { key: "action", header: "Ação", renderCell: item => actionLabel(item.action) }, { key: "status", header: "Correspondência", renderCell: item => statusLabel(item.status) },
      ]} /></TableRegion>
      {s.unresolved > 0 && <Feedback error={`${s.unresolved} correspondências precisam de revisão no arquivo.`} />}
      {s.confirming ? <HStack wrap="wrap" gap={2}><Button label="Voltar" onClick={() => s.setConfirming(false)} isDisabled={s.busy} /><Button label="Confirmar alterações e exclusões" variant="destructive" isLoading={s.busy} onClick={() => void s.apply()} /></HStack>
        : <Button label="Preparar aplicação" isDisabled={!s.preview.canApply} onClick={() => s.setConfirming(true)} />}
    </>}
  </VStack>
}

function SeoImportForm() {
  const { inputRef, ...s } = useSeoImport()
  return <VStack gap={4}>
    <Text color="secondary">Atualize títulos e descrições de busca usando os identificadores das notas.</Text>
    <Link href="/api/admin/notes/seo-import" download>Baixar guia do formato</Link>
    <FilePicker label="Escolher arquivo SEO" accept=".json,application/json" onFile={s.inspect} busy={s.busy} inputRef={inputRef} />
    <Feedback error={s.error} message={s.message} />
    {s.preview && <>
      <Text>{s.preview.counts.update} para atualizar, {s.preview.counts.unchanged} sem mudanças, {s.preview.counts.missing} ausentes.</Text>
      <TableRegion label="Prévia da importação SEO"><Table data={s.preview.items} idKey="id" columns={[
        { key: "seoTitle", header: "Título SEO" }, { key: "status", header: "Estado", renderCell: item => item.status === "update" ? "Atualizar" : item.status === "missing" ? "Ausente" : "Sem mudança" },
      ]} /></TableRegion>
      {s.confirming ? <HStack wrap="wrap" gap={2}><Button label="Voltar" onClick={() => s.setConfirming(false)} isDisabled={s.busy} /><Button label="Confirmar importação" variant="primary" isLoading={s.busy} onClick={() => void s.apply()} /></HStack>
        : <Button label="Preparar importação" isDisabled={!s.preview.canApply} onClick={() => s.setConfirming(true)} />}
    </>}
  </VStack>
}

export function NotesWorkspace(props: Parameters<typeof useAdminNotesTable>[0]) {
  const s = useNotes(props)
  return <VStack gap={6}>
    <PageHeader title="Notas" description="Ideias breves, com espaço para continuar." actions={<Button label="Exportar notas" isDisabled={!s.filtered.length} isLoading={s.downloading} onClick={() => void s.downloadNotes()} />} />
    <Input label="Buscar notas" type="search" value={s.query} onChange={s.setQuery} hasClear />
    <Feedback error={s.actionError} />
    <TableRegion label="Notas publicadas"><Table data={s.filtered} idKey="_id" columns={[
      { key: "title", header: "Nota", renderCell: note => <VStack gap={1}><Link href={`/admin/notes/${note._id}`}>{note.title || note.seoTitle || "Nota sem título"}</Link><Text type="supporting" maxLines={2}>{note.content.replace(/<[^>]*>/g, " ")}</Text>{note.thread && <Text type="supporting">Parte {note.thread.position} de uma thread</Text>}</VStack> },
      { key: "views", header: "Leituras", align: "end", renderCell: note => note.metrics.directViews },
      { key: "indexable", header: "Busca", renderCell: note => note.indexable ? "Indexável" : "Fora da busca" },
      { key: "date", header: "Data", renderCell: note => formatSiteDate(note.publishedAt, { dateStyle: "short" }) },
    ]} emptyState={<Text>Nenhuma nota encontrada.</Text>} /></TableRegion>
    <Disclosure title="Importar revisão editorial"><EditorialImportForm /></Disclosure>
    <Disclosure title="Importar dados de busca"><SeoImportForm /></Disclosure>
  </VStack>
}
