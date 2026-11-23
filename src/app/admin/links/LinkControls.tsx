"use client"

import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { useContentPicker, useCoverField } from "./useLinkEditorControls"
import { Button, Empty, Feedback, FilePicker, Grid, HStack, Input, ProgressBar, Select, Text, VStack } from "../_components/ui"

export function ContentPicker(props: Parameters<typeof useContentPicker>[0]) {
  const { searchRef, ...s } = useContentPicker(props)
  return <Dialog isOpen onOpenChange={open => { if (!open) s.close() }} purpose="info">
    <DialogHeader title="Escolher conteúdo" onOpenChange={open => { if (!open) s.close() }} />
    <VStack gap={4} padding={4}>
      <Input ref={searchRef} label="Buscar conteúdo publicado" type="search" value={s.search} onChange={s.changeSearch} hasClear />
      <Select label="Tipo" value={s.kind} onChange={value => s.setKind(value as typeof s.kind)} options={[{ value: "all", label: "Todos" }, { value: "post", label: "Posts" }, { value: "note", label: "Notas" }, ...(props.allowLinks ? [{ value: "link", label: "Links" }] : [])]} />
      <Feedback error={s.error} />
      {s.loading ? <ProgressBar label="Buscando conteúdo" isIndeterminate /> : s.visible.map(item => <Button key={`${item.kind}:${item.id}`} label={item.title} variant="ghost" onClick={() => s.select(item)} />)}
      {!s.loading && !s.visible.length && <Empty>Nenhum conteúdo encontrado. Tente outro termo.</Empty>}
      <Text type="supporting">Até 50 resultados. Use a busca para encontrar publicações anteriores.</Text>
    </VStack>
  </Dialog>
}

export function CoverControl(props: Parameters<typeof useCoverField>[0]) {
  const s = useCoverField(props)
  return <VStack gap={3}>
    {s.url && <img src={s.url} alt={s.alt || "Prévia da capa selecionada"} className="max-h-48 w-full rounded-lg object-contain" />}
    <HStack gap={2} wrap="wrap"><FilePicker label="Enviar imagem" accept="image/png,image/jpeg,image/webp,image/svg+xml" busy={s.busy || s.disabled} onFile={s.upload} /><Button label={s.library ? "Fechar biblioteca" : "Abrir biblioteca"} isDisabled={s.busy || s.disabled} onClick={() => void s.toggleLibrary()} />{s.url && <Button label="Remover capa" variant="ghost" onClick={s.removeCover} isDisabled={s.busy || s.disabled} />}</HStack>
    {s.library && <Grid columns={{ minWidth: 96, max: 4 }} gap={2}>{s.library.map((image, index) => <Button key={image.url} label={`Usar imagem ${index + 1}`} variant="ghost" onClick={() => s.selectImage(image.url)}><img src={image.url} alt="" loading="lazy" className="aspect-square w-full rounded-md object-cover" /></Button>)}</Grid>}
    {s.library && !s.library.length && <Empty>Nenhuma imagem na biblioteca.</Empty>}
    {s.library && s.mediaCursor && <Button label="Carregar mais imagens" isLoading={s.busy} onClick={() => void s.loadMoreImages()} />}
    <Input label="Endereço da imagem" value={s.url} onChange={s.changeUrl} maxLength={2048} isDisabled={s.disabled || s.busy} />
    <Input label="Descrição da imagem" value={s.alt} onChange={s.changeAlt} maxLength={180} isDisabled={s.disabled || s.busy} />
    <Feedback error={s.error} />
  </VStack>
}
