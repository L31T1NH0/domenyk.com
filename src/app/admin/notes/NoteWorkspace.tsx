"use client"

import { useAdminNoteEditor } from "./useAdminNoteEditor"
import { LexicalEditor } from "@/components/editor/LexicalEditor"
import { Area, Button, DeleteButton, Disclosure, Facts, Feedback, Input, Link, PageHeader, Text, VStack } from "../_components/ui"

export function NoteWorkspace(props: Parameters<typeof useAdminNoteEditor>[0]) {
  const { editorRef, ...s } = useAdminNoteEditor(props)
  return <VStack gap={6}>
    <PageHeader title="Editar nota" back={<Link href="/admin/notes">Voltar para notas</Link>}
      actions={<><Button label="Ver no site" href={`/notes/${s.note._id}`} target="_blank" /><Button label="Salvar alterações" variant="primary" isLoading={s.saving} isDisabled={!s.content.trim()} onClick={() => void s.save()} /></>} />
    <Feedback error={s.message && s.message !== "Alterações salvas." ? s.message : ""} message={s.message === "Alterações salvas." ? s.message : ""} />
    <Input label="Título" isOptional value={s.title} onChange={s.setTitle} maxLength={120} />
    <LexicalEditor initialMarkdown={s.note.content} onChange={s.setContent} editorRef={editorRef} namespace="AdminNote" imageUploadEndpoint="/api/notes/media" />
    <Disclosure title="Busca e compartilhamento">
      <Input label="Título SEO" value={s.seoTitle} onChange={s.setSeoTitle} maxLength={120} />
      <Area label="Descrição SEO" value={s.seoDescription} onChange={s.setSeoDescription} maxLength={300} />
      <Text type="supporting">{s.indexable ? "A nota pode aparecer nos buscadores." : "Preencha os dois campos para liberar a indexação."}</Text>
      <VStack gap={1} padding={4} className="bg-muted rounded-lg"><Text type="supporting">domenyk.com/notes/{s.note._id}</Text><Text weight="semibold">{s.seoTitle || "Título do resultado"}</Text><Text color="secondary">{s.seoDescription || "Descrição do resultado de busca."}</Text></VStack>
    </Disclosure>
    <Disclosure title="Leituras e alcance">
      <Facts items={[["Leituras diretas", s.metrics.directViews], ["Exposições na home", s.metrics.homeImpressions], ["Exposições em notas", s.metrics.notesImpressions], ["Leitura estimada", `${s.note.readingEstimate.estimatedReadingSeconds}s`], ["Complexidade", s.note.readingEstimate.complexity], ["Exposição mínima", `${s.note.readingEstimate.impressionThresholdMs / 1000}s, ${Math.round(s.note.readingEstimate.impressionVisibleRatio * 100)}% visível`]]} />
      {s.note.thread && <Link href={`/notes/${s.note.thread.rootId}`} target="_blank">Abrir thread, parte {s.note.thread.position}</Link>}
    </Disclosure>
    <DeleteButton label="Excluir nota" title="Excluir esta nota?" onDelete={s.remove} />
  </VStack>
}
