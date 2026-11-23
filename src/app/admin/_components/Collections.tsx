"use client"

import type { SerializedPostSummary } from "@/lib/db/posts"
import { Button, DeleteButton, Empty, Feedback, HStack, Input, Link, PageHeader, Panel, Table, TableRegion, Text, VStack, Area, Check, Disclosure } from "./ui"
import { useSeriesEditor } from "@/components/series/useSeriesEditor"
import { useThemeEditor } from "../themes/useThemeEditor"
import { useDefaultThemeInitializer } from "../temas/useDefaultThemeInitializer"

function ThemeInitializer() { useDefaultThemeInitializer(); return null }

export function CollectionsList({ kind, items }: { kind: "series" | "temas"; items: Array<{ id: string; title: string; slug: string; count: number; active: boolean }> }) {
  const series = kind === "series"
  return <VStack gap={6}>
    {!series && <ThemeInitializer />}
    <PageHeader title={series ? "Séries" : "Temas"} description={series ? "Histórias que continuam de um capítulo ao próximo." : "Textos reunidos por uma ideia em comum."}
      actions={<Button label={series ? "Nova série" : "Novo tema"} variant="primary" href={`/admin/${kind}/new`} />} />
    <TableRegion label={series ? "Séries editoriais" : "Temas editoriais"}><Table data={items} idKey="id" columns={[
      { key: "title", header: series ? "Série" : "Tema", renderCell: item => <VStack gap={1}><Link href={`/admin/${kind}/${item.id}`}>{item.title}</Link><Text type="supporting">/{kind}/{item.slug}</Text></VStack> },
      { key: "count", header: series ? "Capítulos" : "Textos", align: "end" },
      { key: "active", header: "Estado", renderCell: item => item.active ? "Público" : "Rascunho" },
    ]} emptyState={<Text>{series ? "Crie sua primeira série para conectar capítulos." : "Crie um tema para reunir seus textos."}</Text>} /></TableRegion>
  </VStack>
}

function PostOrderPicker({ selected, available, query, onQuery, onAdd, onRemove, onMove, newPostHref }: {
  selected: SerializedPostSummary[]; available: SerializedPostSummary[]; query: string; onQuery: (value: string) => void;
  onAdd: (id: string) => void; onRemove: (id: string) => void; onMove: (index: number, direction: -1 | 1) => void; newPostHref?: string;
}) {
  return <>
    <Panel title="Ordem de leitura" actions={newPostHref && <Button label="Escrever capítulo" href={newPostHref} />}>
      <VStack as="ol" gap={0}>{selected.map((post, index) => <HStack as="li" key={post._id} gap={3} hAlign="between" paddingBlock={3} wrap="wrap">
        <VStack gap={1} className="min-w-0 flex-1"><Text weight="medium">{index + 1}. {post.title}</Text><Text type="supporting">{post.published ? "Publicado" : "Rascunho"}, {post.readingTimeMinutes} min</Text></VStack>
        <HStack gap={1}><Button label={`Subir ${post.title}`} isIconOnly icon={<Text>↑</Text>} isDisabled={index === 0} onClick={() => onMove(index, -1)} /><Button label={`Descer ${post.title}`} isIconOnly icon={<Text>↓</Text>} isDisabled={index === selected.length - 1} onClick={() => onMove(index, 1)} /><Button label={`Retirar ${post.title}`} size="sm" variant="ghost" onClick={() => onRemove(post._id)}>Retirar</Button></HStack>
      </HStack>)}</VStack>
      {!selected.length && <Empty>Adicione os textos que farão parte desta coleção.</Empty>}
    </Panel>
    <Disclosure title="Adicionar textos" open={!selected.length}>
      <Input label="Buscar por título ou endereço" type="search" value={query} onChange={onQuery} hasClear />
      {available.slice(0, 40).map(post => <HStack key={post._id} hAlign="between" gap={3} paddingBlock={2}>
        <VStack gap={1} className="min-w-0"><Text>{post.title}</Text><Text type="supporting">{post.series ? `Na série ${post.series.title}` : post.slug}</Text></VStack>
        <Button label={`Adicionar ${post.title}`} size="sm" onClick={() => onAdd(post._id)}>Adicionar</Button>
      </HStack>)}
      {!available.length && <Empty>Nenhum texto encontrado.</Empty>}
    </Disclosure>
  </>
}

export function SeriesComposer(props: Parameters<typeof useSeriesEditor>[0]) {
  const s = useSeriesEditor(props)
  return <VStack gap={6}>
    <PageHeader title={props.series ? "Editar série" : "Nova série"} back={<Link href="/admin/series">Voltar para séries</Link>}
      actions={<Button label={props.series ? "Salvar alterações" : "Criar série"} variant="primary" isLoading={s.saving} onClick={() => void s.save()} />} />
    <Feedback error={s.error} />
    <Input label="Título" value={s.title} onChange={s.changeTitle} maxLength={140} isRequired />
    <Area label="Apresentação" value={s.description} onChange={s.setDescription} maxLength={1200} />
    <PostOrderPicker selected={s.selectedPosts} available={s.availablePosts} query={s.query} onQuery={s.setQuery} onAdd={s.addPost} onRemove={s.removePost} onMove={s.move}
      newPostHref={props.series ? `/admin/posts/new?series=${encodeURIComponent(props.series.publicId)}` : undefined} />
    <Disclosure title="Publicação e endereço">
      <Input label="Endereço" value={s.slug} onChange={s.changeSlug} description="Aparece depois de /series/." />
      <Check label="Série pública" value={s.published} onChange={s.setPublished} />
      <Text type="supporting">{s.postIds.length} capítulos, {s.totalReadingTime} minutos de leitura.</Text>
      {props.series?.published && <Link href={`/series/${props.series.slug}`} target="_blank">Ler série no site</Link>}
    </Disclosure>
    {props.series && <DeleteButton title="Excluir esta série?" description="Os posts serão mantidos, sem o vínculo entre capítulos." onDelete={s.remove} label="Excluir série" />}
  </VStack>
}

export function ThemeComposer(props: Parameters<typeof useThemeEditor>[0]) {
  const s = useThemeEditor(props)
  return <VStack gap={6}>
    <PageHeader title={props.theme ? "Editar tema" : "Novo tema"} back={<Link href="/admin/temas">Voltar para temas</Link>}
      actions={<Button label={props.theme ? "Salvar alterações" : "Criar tema"} variant="primary" isLoading={s.saving} onClick={() => void s.save()} />} />
    <Feedback error={s.error} />
    <Input label="Nome" value={s.name} onChange={s.changeName} maxLength={80} isRequired />
    <Area label="Descrição" value={s.description} onChange={s.setDescription} maxLength={500} />
    <PostOrderPicker selected={s.selectedPosts} available={s.availablePosts} query={s.query} onQuery={s.setQuery} onAdd={s.addPost} onRemove={s.removePost} onMove={s.move} />
    <Disclosure title="Publicação e endereço">
      <Input label="Endereço" value={s.slug} onChange={s.changeSlug} description="Aparece depois de /temas/." />
      <Check label="Tema público" value={s.active} onChange={s.setActive} description="Libera a página e a indexação nos buscadores." />
      {props.theme?.active && <Link href={`/temas/${props.theme.slug}`} target="_blank">Ver tema no site</Link>}
    </Disclosure>
    {props.theme && <DeleteButton title="Excluir este tema?" description="Os posts da coleção serão mantidos." onDelete={s.remove} label="Excluir tema" />}
  </VStack>
}
