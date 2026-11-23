"use client"

import { NumberInput } from "@astryxdesign/core/NumberInput"
import { useWritingForm, useWritingManager } from "./useWritingManager"
import { Button, Disclosure, Empty, Feedback, HStack, Input, PageHeader, Panel, ProgressBar, VStack } from "../_components/ui"

function WritingEntry(props: Parameters<typeof useWritingForm>[0]) {
  const s = useWritingForm(props)
  return <form onSubmit={s.submit}>
    <VStack gap={4} paddingBlock={4}>
      <Input label="Título do texto" value={s.title} onChange={s.setTitle} maxLength={180} isRequired isDisabled={s.busy} />
      <NumberInput label="Progresso" value={Number(s.progress)} onChange={value => s.setProgress(String(value))} min={0} max={100} isIntegerOnly units="%" isWheelEnabled={false} isDisabled={s.busy} />
      {props.entry && <ProgressBar label={`Progresso de ${s.title}`} value={Number(s.progress)} isLabelHidden />}
      <HStack gap={2} wrap="wrap"><Button label={props.entry ? "Salvar alterações" : "Adicionar texto"} type="submit" variant={props.entry ? "secondary" : "primary"} isLoading={s.busy} isDisabled={!s.dirty} />
        {props.entry && <Button label={props.entry.completed ? "Retomar escrita" : "Concluir texto"} variant="ghost" isDisabled={s.busy} onClick={() => void s.save(!props.entry?.completed)} />}</HStack>
      <Feedback error={s.error} message={s.notice} />
    </VStack>
  </form>
}

export function WritingWorkspace(props: Parameters<typeof useWritingManager>[0]) {
  const s = useWritingManager(props)
  return <VStack gap={6}>
    <PageHeader title="Em escrita" description="O que está tomando forma. Títulos e progresso aparecem na home." />
    <Disclosure title="Adicionar texto" open={!s.active.length}><WritingEntry onSaved={s.handleSaved} /></Disclosure>
    <Panel title="Em andamento">{s.active.map(entry => <WritingEntry key={entry.id} entry={entry} onSaved={s.handleSaved} />)}{!s.active.length && <Empty>Seu próximo texto começa acima.</Empty>}</Panel>
    {s.completed.length > 0 && <Disclosure title={`Concluídos (${s.completed.length})`}>{s.completed.map(entry => <WritingEntry key={entry.id} entry={entry} onSaved={s.handleSaved} />)}</Disclosure>}
  </VStack>
}
