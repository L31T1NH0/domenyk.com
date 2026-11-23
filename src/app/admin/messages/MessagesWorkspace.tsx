"use client"

import { useAdminMessages, statusLabel } from "./useAdminMessages"
import { messageCategoryLabel } from "@/lib/message-categories"
import { formatSiteDate } from "@/lib/datetime"
import { Area, Button, DeleteButton, Disclosure, Empty, Feedback, HStack, PageHeader, ProgressBar, Select, Text, VStack } from "../_components/ui"

export function MessagesWorkspace() {
  const s = useAdminMessages()
  async function run(action: () => Promise<unknown>) {
    s.setActionError("")
    try { await action() }
    catch { s.setActionError("Não foi possível concluir a ação. Tente novamente."); s.setBusy(false) }
  }
  return <VStack gap={6}>
    <PageHeader title="Mensagens" description="Um espaço para ouvir e responder." actions={<Button label={s.archived ? "Ver caixa de entrada" : "Ver arquivadas"} onClick={() => s.setArchived(value => !value)} />} />
    <Feedback error={s.actionError} />
    {!s.threads ? <ProgressBar label="Carregando mensagens" isIndeterminate /> : !s.threads.length ? <Empty>{s.archived ? "Nenhuma conversa arquivada." : "As mensagens dos leitores aparecerão aqui."}</Empty> : <>
      <Select label="Conversa" value={s.selected ?? ""} onChange={id => void run(() => s.selectThread(id))} options={s.threads.map(thread => ({ value: thread._id, label: thread.subject, description: `${thread.ownerName}, ${messageCategoryLabel(thread.category)}` }))} hasSearch width="100%" />
      {s.hasMore && <Button label="Carregar conversas anteriores" onClick={() => void run(s.loadMore)} />}
      {s.thread && <VStack gap={5}>
        <HStack hAlign="between" gap={4} wrap="wrap"><Text weight="semibold">{s.thread.subject}</Text><Text type="supporting">{statusLabel(s.thread.status)}</Text></HStack>
        <Text color="secondary">Enviada por {s.thread.ownerName}</Text>
        {!s.thread.entries ? <ProgressBar label="Carregando conversa" isIndeterminate /> : <VStack as="ol" gap={6}>{s.thread.entries.map(entry => <VStack as="li" key={entry._id} gap={2}>
          <HStack hAlign="between" wrap="wrap" gap={2}><Text weight="medium">{entry.authorName}</Text><Text type="supporting">{formatSiteDate(entry.createdAt, { dateStyle: "short", timeStyle: "short" })}</Text></HStack>
          <Text as="p" className="whitespace-pre-wrap" textWrap="pretty">{entry.body}</Text>
          {entry.isOwn && <Text type="supporting">{entry.readAt ? `Lida em ${formatSiteDate(entry.readAt, { dateStyle: "short", timeStyle: "short" })}` : "Ainda não lida"}</Text>}
        </VStack>)}</VStack>}
        {s.thread.status === "closed" ? <Button label="Reabrir conversa" onClick={() => void run(() => s.changeStatus("open"))} isDisabled={s.busy} /> : <form onSubmit={event => { event.preventDefault(); void run(s.answer) }}><VStack gap={3}>
          <Area label="Sua resposta" value={s.reply} onChange={s.setReply} rows={5} isDisabled={s.busy} />
          <HStack hAlign="end"><Button label="Enviar resposta" type="submit" variant="primary" isLoading={s.busy} isDisabled={!s.reply.trim()} /></HStack>
        </VStack></form>}
        <Disclosure title="Gerenciar conversa"><HStack wrap="wrap" gap={2}>
          <Button label="Aceitar sugestão" onClick={() => void run(() => s.changeStatus("accepted"))} isDisabled={s.busy} />
          <Button label="Negar sugestão" onClick={() => void run(() => s.changeStatus("declined"))} isDisabled={s.busy} />
          {s.thread.status !== "closed" && <Button label="Encerrar" onClick={() => void run(() => s.changeStatus("closed"))} isDisabled={s.busy} />}
          <Button label={s.archived ? "Desarquivar" : "Arquivar"} onClick={() => void run(s.archiveThread)} isDisabled={s.busy} />
          <Button label="Exportar conversa" onClick={() => void s.downloadThread()} isLoading={s.exporting} />
          <DeleteButton title="Excluir esta conversa?" description="O assunto e todas as respostas serão excluídos." onDelete={s.deleteThread} disabled={s.busy} />
        </HStack></Disclosure>
      </VStack>}
    </>}
  </VStack>
}
