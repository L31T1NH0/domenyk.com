"use client"

import { useMediaLibrary, formatBytes } from "./useMediaLibrary"
import { Button, DeleteButton, Empty, Feedback, FilePicker, Grid, HStack, PageHeader, Text, VStack } from "../_components/ui"

export function MediaWorkspace(props: Parameters<typeof useMediaLibrary>[0]) {
  const { fileRef, ...s } = useMediaLibrary(props)
  return <VStack gap={6}>
    <PageHeader title="Mídia" description={`${s.media.length} arquivos para dar forma aos seus textos.`}
      actions={<FilePicker label="Enviar imagem" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" onFile={s.upload} inputRef={fileRef} busy={s.uploading} />} />
    <section onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && !s.uploading) void s.upload(file) }}
      className="rounded-lg border border-dashed border-(--color-border-emphasized) p-6 text-center">
      <Text color="secondary">Arraste uma imagem para cá ou use Enviar imagem. SVG, PNG, JPG e WebP.</Text>
    </section>
    <Feedback error={s.error} message={s.copied ? "Endereço da imagem copiado." : ""} />
    <Grid columns={{ minWidth: 180, max: 3 }} gap={6}>
      {s.media.map(item => <VStack as="figure" key={item.url} gap={3}>
        <img src={item.url} alt={item.pathname} loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-contain" />
        <figcaption><VStack gap={1}><Text weight="medium" maxLines={1}>{item.pathname}</Text><Text type="supporting">{formatBytes(item.size)}</Text></VStack></figcaption>
        <HStack gap={1} wrap="wrap"><Button label="Copiar endereço" size="sm" clickAction={() => s.copyUrl(item.url)} /><DeleteButton title="Excluir esta imagem?" description="O arquivo será removido. Conteúdos que usam esta imagem podem ficar sem ela." onDelete={() => s.remove(item)} disabled={s.deletingUrl === item.url} /></HStack>
      </VStack>)}
    </Grid>
    {!s.media.length && <Empty>Sua biblioteca começa com a primeira imagem enviada.</Empty>}
  </VStack>
}
