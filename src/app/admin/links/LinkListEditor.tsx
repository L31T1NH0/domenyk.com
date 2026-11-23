"use client"

import { NumberInput } from "@astryxdesign/core/NumberInput"
import { DateTimeInput } from "@astryxdesign/core/DateTimeInput"
import type { ComponentProps } from "react"
import { useLinksEditor, dateInput } from "./useLinksEditor"
import { canonicalLinkURL, type LinkInput } from "@/lib/links"
import { Button, Check, Disclosure, Empty, Feedback, HStack, Input, Area, Link, Panel, Select, Text, VStack } from "../_components/ui"
import { ContentPicker, CoverControl } from "./LinkControls"

export function LinkListEditor(props: Parameters<typeof useLinksEditor>[0]) {
  const { formRef, titleRef, ...s } = useLinksEditor(props)
  const update = (patch: Partial<LinkInput>) => s.setInput(current => ({ ...current, ...patch }))
  const sectionOptions = props.sections.map(section => ({ value: section.id, label: section.title }))
  const allowed = !s.busy && props.sections.length > 0
  return <VStack gap={6}>
    <HStack gap={2} wrap="wrap"><Button label="Adicionar link" onClick={() => { s.setBulk(false); s.reset() }} /><Button label="Do meu site" onClick={() => s.setPicker(true)} /><Button label="Adicionar vários" onClick={() => s.setBulk(true)} /></HStack>
    {!props.sections.length && <Feedback message="Crie e salve uma seção na aba Página para adicionar links." />}
    {s.bulk ? <form onSubmit={s.saveBatch}><VStack gap={4}>
      <Area label="Endereços" description="Um por linha, até 50. Repetidos e inválidos não serão adicionados." value={s.addresses} onChange={s.setAddresses} rows={6} isDisabled={!allowed} />
      <Select label="Seção" value={s.sectionId} onChange={s.changeSection} options={sectionOptions} isDisabled={!allowed} />
      <VStack gap={2}>{s.batch.map((item, index) => <HStack key={index} hAlign="between" gap={3}><Text type="supporting" wordBreak="break-all">{item.url}</Text><Text type="supporting">{!item.valid ? "Inválido" : item.duplicate ? "Repetido" : "Pronto"}</Text></HStack>)}</VStack>
      <Button label="Adicionar links válidos" type="submit" variant="primary" isLoading={s.busy} isDisabled={!allowed || !s.batch.some(item => item.valid && !item.duplicate)} />
    </VStack></form> : <form ref={formRef} onSubmit={s.save}><VStack gap={4}>
      <Input label="Endereço do link" value={s.input.url} onChange={url => update({ url })} onBlur={s.normalizeAddress} maxLength={2048} isRequired isDisabled={!allowed} />
      <Input ref={titleRef} label="Título" value={s.input.title} onChange={title => update({ title })} maxLength={100} isDisabled={!allowed} />
      <Select label="Seção" value={s.sectionId} onChange={s.changeSection} options={sectionOptions} isDisabled={!allowed} />
      <Disclosure title="Apresentação e ícone">
        <Select label="Apresentação" value={s.input.appearance} onChange={value => update({ appearance: value as LinkInput["appearance"] })} options={[{ value: "simple", label: "Link simples" }, { value: "description", label: "Com descrição" }, { value: "image", label: "Com imagem" }]} />
        {s.input.appearance !== "simple" && <Area label="Descrição" value={s.input.description} onChange={description => update({ description })} maxLength={180} />}
        {s.input.appearance === "image" && <CoverControl url={s.input.cover} alt={s.input.coverAlt} onChange={(cover, coverAlt) => update({ cover, coverAlt })} onBusyChange={s.setBusy} />}
        <Input label="Buscar ícone" type="search" value={s.iconSearch} onChange={s.setIconSearch} />
        <Select label="Ícone" value={s.input.icon} onChange={value => update({ icon: value as LinkInput["icon"] })} options={s.visibleIcons.map(([value, label]) => ({ value, label }))} />
      </Disclosure>
      <Disclosure title="Publicação e ordem">
        <Check label="Habilitar publicação" value={s.input.published} onChange={published => update({ published })} />
        <DateTimeInput label="Publicar a partir de" value={(dateInput(s.input.startsAt) || undefined) as ComponentProps<typeof DateTimeInput>["value"]} onChange={value => update({ startsAt: value ? new Date(value).toISOString() : null })} hasClear hourFormat="24h" />
        <DateTimeInput label="Ocultar a partir de" value={(dateInput(s.input.endsAt) || undefined) as ComponentProps<typeof DateTimeInput>["value"]} onChange={value => update({ endsAt: value ? new Date(value).toISOString() : null })} hasClear hourFormat="24h" />
        <Text type="supporting">Horário local do navegador. Deixe vazio para não definir prazo.</Text>
        <NumberInput label="Ordem" value={s.input.order} onChange={order => update({ order })} min={0} max={10000} isIntegerOnly isWheelEnabled={false} />
      </Disclosure>
      <HStack gap={2} wrap="wrap"><Button label={s.editingId ? "Salvar alterações" : "Adicionar link"} type="submit" variant="primary" isLoading={s.busy} isDisabled={!allowed} />{s.editingId && <Button label="Cancelar edição" onClick={() => s.reset()} isDisabled={s.busy} />}</HStack>
    </VStack></form>}
    <Feedback error={s.error} message={s.notice} />
    {props.sections.map(section => {
      const items = props.links.filter(link => link.section === section.id).sort((a, b) => a.order - b.order)
      if (!items.length) return null
      return <Panel title={section.title} key={section.id}><VStack as="ul" gap={4}>{items.map((link, index) => {
        const health = s.checks[link.id] || link.health
        const duplicate = props.links.some(other => other.id !== link.id && canonicalLinkURL(other.url) === canonicalLinkURL(link.url))
        return <VStack as="li" key={link.id} gap={2} draggable={!s.busy} onDragStart={event => { s.setDragged(link.id); event.dataTransfer.setData("text/plain", link.id) }} onDragEnd={() => s.setDragged(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (s.dragged) void s.reorder(s.dragged, link) }}>
          <HStack hAlign="between" gap={3} wrap="wrap"><VStack gap={1} className="min-w-0"><Link href={link.url} target="_blank">{link.title}</Link><Text type="supporting" wordBreak="break-all">{link.url}</Text></VStack><Button label={`Editar ${link.title}`} size="sm" onClick={() => s.edit(link)}>Editar</Button></HStack>
          <Text type="supporting">{!link.published ? "Oculto" : link.startsAt && Date.parse(link.startsAt) > s.now ? "Agendado" : link.endsAt && Date.parse(link.endsAt) <= s.now ? "Encerrado" : "Público"}{duplicate ? "; endereço repetido" : ""}{health ? `; ${health === "ok" ? "endereço disponível" : health === "broken" ? "link indisponível" : "endereço não confirmado"}` : ""}</Text>
          <Disclosure title="Organizar e verificar"><HStack wrap="wrap" gap={2}>
            <Button label="Subir" isDisabled={s.busy || index === 0} onClick={() => void s.reorder(link.id, items[index - 1])} />
            <Button label="Descer" isDisabled={s.busy || index === items.length - 1} onClick={() => void s.reorder(link.id, items[index + 1])} />
            <Button label="Verificar endereço" isDisabled={s.busy} onClick={() => void s.check(link)} />
            <Button label="Excluir link" variant="ghost" isDisabled={s.busy} onClick={() => void s.remove(link)} />
          </HStack></Disclosure>
        </VStack>
      })}</VStack></Panel>
    })}
    {!props.links.length && <Empty>Adicione seu primeiro link acima.</Empty>}
    {s.picker && <ContentPicker onClose={() => s.setPicker(false)} onSelect={s.selectContent} />}
  </VStack>
}
