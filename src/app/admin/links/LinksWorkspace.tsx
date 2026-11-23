"use client"

import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { LinksPageView } from "@/components/links/LinksPageView"
import { type ContentSelection } from "@/lib/link-page"
import { useLinksManager, initialSettings } from "./useLinksManager"
import { useLinkStats } from "./useLinkStats"
import { ContentPicker, CoverControl } from "./LinkControls"
import { LinkListEditor } from "./LinkListEditor"
import { Area, Button, Check, Disclosure, Feedback, HStack, Input, PageHeader, Panel, ProgressBar, Select, Table, TableRegion, Tabs, Text, VStack } from "../_components/ui"

function Clicks(props: Parameters<typeof useLinkStats>[0]) {
  const s = useLinkStats(props)
  return <VStack gap={5}>
    <HStack hAlign="between" wrap="wrap" gap={4}><Text type="display-3">{s.totalClicks.toLocaleString("pt-BR")} cliques</Text><Select label="Período" value={s.days} onChange={s.changeDays} options={[{ value: "7", label: "Últimos 7 dias" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }]} /></HStack>
    <Feedback error={s.error} />
    {!s.stats && !s.error && <ProgressBar label="Carregando cliques" isIndeterminate />}
    {s.stats && <>
      <TableRegion label="Cliques por conteúdo"><Table data={s.ranking} idKey={item => `${item.kind}:${item.id}`} columns={[{ key: "title", header: "Conteúdo", renderCell: item => item.source?.title || item.link?.title || "Conteúdo indisponível" }, { key: "clicks", header: "Cliques", align: "end" }]} emptyState={<Text>Nenhum clique neste período.</Text>} /></TableRegion>
      <Disclosure title="Cliques por dia"><TableRegion label="Cliques diários"><Table data={s.stats.daily} idKey="day" columns={[{ key: "day", header: "Dia" }, { key: "clicks", header: "Cliques", align: "end" }]} /></TableRegion></Disclosure>
    </>}
    <Text type="supporting">Cliques totais na página pública, incluindo destaques e leituras. A prévia não registra cliques.</Text>
  </VStack>
}

export function LinksWorkspace(props: Parameters<typeof useLinksManager>[0]) {
  const s = useLinksManager(props)
  function selections(group: "featured" | "readings") {
    return <VStack as="ol" gap={4}>{s.settings[group].map((selection, index) => {
      const source = s.pool.find(item => item.kind === selection.kind && item.id === selection.id)
      return <VStack as="li" key={`${selection.kind}:${selection.id}`} gap={3}>
        <HStack hAlign="between" wrap="wrap" gap={2}><Text weight="medium">{source?.title || "Conteúdo selecionado"}</Text><HStack gap={1}><Button label="Subir seleção" isDisabled={index === 0 || s.busy} size="sm" onClick={() => s.moveSelection(group, index)}>Subir</Button><Button label="Retirar seleção" size="sm" variant="ghost" isDisabled={s.busy} onClick={() => s.removeSelection(group, index)}>Retirar</Button></HStack></HStack>
        <Disclosure title="Personalizar texto e capa">
          <Input label="Título personalizado" value={selection.title} onChange={title => s.updateSelection(group, index, { title })} maxLength={180} isDisabled={s.busy} />
          {selection.kind !== "note" && <Area label="Descrição personalizada" value={selection.description} onChange={description => s.updateSelection(group, index, { description })} maxLength={500} isDisabled={s.busy} />}
          <Select label="Capa" value={selection.coverMode} onChange={value => s.updateSelection(group, index, { coverMode: value as ContentSelection["coverMode"] })} options={[{ value: "original", label: "Capa do conteúdo" }, { value: "none", label: "Sem capa" }, { value: "custom", label: "Outra imagem" }]} isDisabled={s.busy} />
          {selection.coverMode === "custom" && <CoverControl url={selection.cover} alt={selection.coverAlt} onChange={(cover, coverAlt) => s.updateSelection(group, index, { cover, coverAlt })} onBusyChange={s.setBusy} />}
        </Disclosure>
      </VStack>
    })}</VStack>
  }
  return <VStack gap={6}>
    <PageHeader title="Links" description="Sua página de entrada, com o que importa agora." actions={<Button label="Ver página pública" href="/links" target="_blank" />} />
    <Tabs label="Configurações de links" value={s.tab} onChange={value => s.setTab(value as typeof s.tab)} options={[{ value: "content", label: "Links" }, { value: "page", label: "Página" }, { value: "featured", label: "Destaques e leituras" }, { value: "stats", label: "Cliques" }]} />
    <Feedback error={s.error} message={s.notice} />
    <section hidden={s.tab !== "content"}><LinkListEditor links={props.links} sections={(s.saved || initialSettings(props.links)).sections} /></section>
    {(s.tab === "page" || s.tab === "featured") && <form onSubmit={s.save}><VStack gap={6}>
      {s.tab === "page" ? <>
        <Area label="Chamada principal" value={s.settings.heading} onChange={value => s.change("heading", value)} maxLength={300} rows={4} isDisabled={s.busy} />
        <Area label="Apresentação" value={s.settings.intro} onChange={value => s.change("intro", value)} maxLength={500} isDisabled={s.busy} />
        <Disclosure title="Busca e compartilhamento"><Input label="Título da página" value={s.settings.metaTitle} onChange={value => s.change("metaTitle", value)} maxLength={180} isDisabled={s.busy} /><Area label="Descrição da página" value={s.settings.metaDescription} onChange={value => s.change("metaDescription", value)} maxLength={500} isDisabled={s.busy} /></Disclosure>
        <Panel title="Seções">
          {s.settings.sections.map((section, index) => <VStack gap={3} key={section.id} paddingBlock={3}>
            <Input label="Nome da seção" value={section.title} onChange={title => s.updateSection(index, { title })} maxLength={80} isRequired isDisabled={s.busy} />
            <Select label="Apresentação" value={section.layout} onChange={value => s.updateSection(index, { layout: value as "row" | "cards" })} options={[{ value: "row", label: "Links em linha" }, { value: "cards", label: "Cartões" }]} isDisabled={s.busy} />
            <HStack wrap="wrap" gap={2}><Button label="Subir seção" isDisabled={index === 0 || s.busy} onClick={() => s.moveSection(index, -1)}>Subir</Button><Button label="Descer seção" isDisabled={index === s.settings.sections.length - 1 || s.busy} onClick={() => s.moveSection(index, 1)}>Descer</Button><Button label="Excluir seção" variant="ghost" isDisabled={s.busy || props.links.some(link => link.section === section.id)} onClick={() => s.removeSection(section.id)} /></HStack>
          </VStack>)}
          <Button label="Adicionar seção" onClick={s.addSection} isDisabled={s.busy || s.settings.sections.length >= 20} />
        </Panel>
      </> : <>
        <Panel title="Destaques">
          <Input label="Título da seção" value={s.settings.featuredHeading} onChange={value => s.change("featuredHeading", value)} maxLength={100} isDisabled={s.busy} />
          <Check label="Incluir a publicação mais recente automaticamente" value={s.settings.includeLatest} onChange={value => s.change("includeLatest", value)} isDisabled={s.busy} />
          {selections("featured")}
          <Button label={`Escolher destaque (${s.settings.featured.length}/2)`} onClick={() => s.setPicker("featured")} isDisabled={s.busy || s.settings.featured.length >= 2} />
        </Panel>
        <Panel title="Leituras fixas"><Input label="Título da seção" value={s.settings.readingsHeading} onChange={value => s.change("readingsHeading", value)} maxLength={100} isDisabled={s.busy} />{selections("readings")}<Button label="Adicionar leitura" onClick={() => s.setPicker("readings")} isDisabled={s.busy || s.settings.readings.length >= 20} /></Panel>
      </>}
      <HStack gap={3} wrap="wrap"><Button label="Salvar página" variant="primary" type="submit" isLoading={s.busy} /><Button label="Ver prévia" onClick={() => s.setShowPreview(true)} /></HStack>
      {JSON.stringify(s.settings) !== JSON.stringify(s.saved) && <Text type="supporting">Há alterações ainda não publicadas.</Text>}
    </VStack></form>}
    {s.tab === "stats" && <Clicks content={s.pool} links={props.links} />}
    {s.tab === "content" && <Button label="Ver prévia da página" onClick={() => s.setShowPreview(true)} />}
    {s.showPreview && <Dialog isOpen onOpenChange={s.setShowPreview} width="min(100%, 60rem)"><DialogHeader title="Prévia da página" subtitle="A prévia não publica alterações nem registra cliques." onOpenChange={s.setShowPreview} /><VStack padding={6}><LinksPageView data={s.preview} links={props.links} preview /></VStack></Dialog>}
    {s.picker && <ContentPicker allowLinks={s.picker === "readings"} onClose={() => s.setPicker(null)} onSelect={s.selectContent} />}
  </VStack>
}
