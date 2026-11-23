"use client"

import { usePostEditor } from "@/components/editor/usePostEditor"
import { LexicalEditor } from "@/components/editor/LexicalEditor"
import { POST_LOCALES, POST_LOCALE_DETAILS, type PostLocale } from "@/lib/post-locales"
import { Area, Button, Check, Disclosure, Feedback, FilePicker, HStack, Input, Link, PageHeader, Select, Tabs, Text, VStack } from "../_components/ui"

export function PostComposer(props: Parameters<typeof usePostEditor>[0]) {
  const { titleRef, coverFileRef, editorRef, ...s } = usePostEditor(props)
  const draft = s.activeDraft
  const locale = POST_LOCALE_DETAILS[s.activeLocale]
  return <VStack gap={6}>
    <PageHeader title={s.postId ? "Editar post" : "Novo post"} back={<Link href="/admin/posts">Voltar para posts</Link>}
      actions={<>
        <Button label={s.activeVersion.exists ? "Salvar alterações" : "Salvar rascunho"} isLoading={s.saving} isDisabled={s.translationBlocked} onClick={() => void s.save()} />
        <Button label={s.activeVersion.published ? "Despublicar" : "Publicar"} variant="primary" isLoading={s.saving} isDisabled={s.translationBlocked} onClick={() => void s.save(!s.activeVersion.published)} />
      </>} />
    <Tabs label="Idioma do post" value={s.activeLocale} onChange={value => s.selectLocale(value as PostLocale)} options={POST_LOCALES.map(value => ({ value, label: `${POST_LOCALE_DETAILS[value].adminLabel}${s.dirtyLocales.has(value) ? " *" : ""}` }))} />
    <Text type="supporting">{s.activeStatus.label}{s.dirtyLocales.has(s.activeLocale) ? ". Há alterações não salvas." : ""}</Text>
    <Feedback error={s.error} message={s.notice || (s.translationBlocked ? "Salve o original em português antes de salvar esta tradução." : "")} />
    <Input ref={titleRef} label={`Título em ${locale.adminLabel.toLowerCase()}`} value={draft.title} onChange={s.handleTitleChange} isRequired maxLength={180} size="lg" />
    <VStack gap={3}>
      <Text type="label">Texto</Text>
      <LexicalEditor key={s.activeLocale} namespace={`AdminPost-${s.activeLocale}`} initialMarkdown={draft.content} onChange={s.handleContentChange} editorRef={editorRef} placeholder="Comece seu texto…" />
    </VStack>
    <Disclosure title="Resumo e referências">
      <Area label="Descrição editorial" value={draft.subtitle} onChange={value => s.updateActiveDraft({ subtitle: value })} isOptional />
      <Area label="Resumo para listagens" value={draft.excerpt} onChange={value => s.updateActiveDraft({ excerpt: value })} isOptional />
      <Input label="Tags" description="Separe as palavras por vírgula." value={draft.tags} onChange={value => s.updateActiveDraft({ tags: value })} />
      <Area label="Fontes" description="Uma por linha: Nome da fonte | https://endereco.com" value={draft.sources} onChange={value => s.updateActiveDraft({ sources: value })} />
    </Disclosure>
    <Disclosure title="Busca e compartilhamento">
      <Input label="Título SEO" value={draft.seoTitle} onChange={s.handleSeoTitleChange} maxLength={180} />
      <Input label="Endereço do post" value={s.activeLocale === "pt" ? s.slug : draft.localizedSlug} onChange={s.handleSlugChange} />
      <Area label="Descrição SEO" value={draft.seoDescription} onChange={value => s.updateActiveDraft({ seoDescription: value })} maxLength={500} />
      <VStack gap={1} padding={4} className="rounded-lg bg-muted">
        <Text type="supporting">domenyk.com/{s.activeLocale === "pt" ? "" : `${s.activeLocale}/`}posts/{s.activeLocale === "pt" ? s.slug : draft.localizedSlug}</Text>
        <Text weight="semibold">{draft.seoTitle.trim() || draft.title || "Título do resultado"}</Text>
        <Text color="secondary">{draft.seoDescription.trim() || draft.excerpt || draft.subtitle || "Adicione uma descrição para a busca."}</Text>
      </VStack>
    </Disclosure>
    {s.coverUrl && <Input label="Descrição da capa neste idioma" value={draft.coverAlt} onChange={value => s.updateActiveDraft({ coverAlt: value })} />}
    {s.activeLocale === "pt" && <>
      <Disclosure title="Organização e publicação">
        <Select label="Estilo" value={s.style} onChange={value => s.setStyle(value as typeof s.style)} options={[{ value: "standard", label: "Padrão" }, { value: "editorial", label: "Editorial" }, { value: "opinion", label: "Opinião" }]} />
        <Check label="Mostrar na timeline" description="Posts fora da timeline também ficam fora das buscas e do sitemap." value={s.visibleInTimeline} onChange={s.setVisibleInTimeline} />
        <Select label="Série" value={s.selectedSeriesPublicId} isLoading={s.loadingSeries} onChange={s.setSelectedSeriesPublicId} options={[{ value: "", label: "Post independente" }, ...s.seriesOptions.map(series => ({ value: series.publicId, label: series.title }))]} />
        <Link href="/admin/series/new">Criar série</Link>
        <Text type="label">Temas</Text>
        {s.themes.map(theme => <Check key={theme._id} label={theme.name} description={theme.active ? undefined : "Tema inativo"} value={s.selectedThemeIds.includes(theme._id)} onChange={checked => s.toggleTheme(theme._id, checked)} />)}
        {!s.themes.length && <Link href="/admin/temas/new">Criar primeiro tema</Link>}
      </Disclosure>
      <Disclosure title="Capa, áudio e coautoria">
        {s.coverUrl && <img src={s.coverUrl} alt={draft.coverAlt || "Prévia da capa selecionada"} className="max-h-60 w-full rounded-lg object-contain" />}
        <HStack wrap="wrap" gap={2}><FilePicker label="Enviar capa" accept="image/png,image/jpeg,image/webp" onFile={s.uploadCover} busy={s.uploadingCover} inputRef={coverFileRef} />{s.coverUrl && <Button label="Remover capa" variant="ghost" onClick={() => s.setCoverUrl("")} />}</HStack>
        <Input label="Endereço da capa" type="url" value={s.coverUrl} onChange={s.setCoverUrl} />
        <Check label="Mostrar capa na timeline" value={s.showCoverInTimeline} onChange={s.setShowCoverInTimeline} isDisabled={!s.coverUrl} />
        <Input label="Endereço do áudio" type="url" value={s.audioUrl} onChange={s.setAudioUrl} />
        <Select label="Coautor" value={s.coAuthorUserId} onChange={s.handleCoAuthorChange} isLoading={s.loadingCoAuthors} options={[{ value: "", label: "Sem coautor" }, ...s.coAuthors.map(user => ({ value: user.id, label: user.name }))]} />
        <Feedback error={s.coAuthorsError} />
        <Input label="Imagem do coautor" type="url" value={s.friendImage} onChange={s.setFriendImage} />
      </Disclosure>
    </>}
  </VStack>
}
