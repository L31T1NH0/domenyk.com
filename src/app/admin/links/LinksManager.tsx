"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@heroicons/react/24/outline"
import { LinksPageView } from "@/components/links/LinksPageView"
import { contentSelection, parseLinkPageSettings, selectFeatured, type ContentSelection, type LinkContent, type LinkPageData, type LinkPageSettings } from "@/lib/link-page"
import { LINK_SECTIONS, type SiteLink } from "@/lib/links"
import { ContentPicker, CoverField, linkEditorRequest } from "./LinkEditorControls"
import { LinksEditor } from "./LinksEditor"
import { LinkStats } from "./LinkStats"

function initialSettings(links: SiteLink[]): LinkPageSettings {
  // Legacy names are editable initial values, never a public-page fallback.
  const ids = [...new Set(links.length ? links.map(link => link.section) : Object.keys(LINK_SECTIONS))]
  return { heading: "", intro: "", metaTitle: "", metaDescription: "", featuredHeading: "", readingsHeading: "", includeLatest: true, featured: [], readings: [], sections: ids.map(id => ({ id, title: LINK_SECTIONS[id as keyof typeof LINK_SECTIONS] || id, layout: "row" })) }
}
function selectionPreview(selection: ContentSelection, pool: LinkContent[]): LinkContent | undefined {
  const source = pool.find(item => item.kind === selection.kind && item.id === selection.id)
  if (!source) return undefined
  return { ...source, title: selection.title || source.title, description: selection.description || source.description, cover: selection.coverMode === "none" ? "" : selection.coverMode === "custom" ? selection.cover : source.cover, coverAlt: selection.coverMode === "custom" ? selection.coverAlt : source.coverAlt }
}

export function LinksManager({ links, settings: initial, pageData, catalog, latest }: { links: SiteLink[]; settings: LinkPageSettings | null; pageData: LinkPageData; catalog: LinkContent[]; latest: LinkContent | null }) {
  const router = useRouter()
  const [tab, setTab] = useState<"content" | "page" | "featured" | "stats">(initial ? "content" : "page")
  const [settings, setSettings] = useState(() => initial || initialSettings(links))
  const [saved, setSaved] = useState(initial)
  const [pool, setPool] = useState(() => [...catalog, ...pageData.featured, ...pageData.readings])
  const [picker, setPicker] = useState<"featured" | "readings" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showPreview, setShowPreview] = useState(true)
  const selected = settings.featured.map(item => selectionPreview(item, pool)).filter((item): item is LinkContent => !!item)

  const preview: LinkPageData = { settings, featured: selectFeatured(settings.includeLatest ? latest : null, selected), readings: settings.readings.map(item => selectionPreview(item, pool)).filter((item): item is LinkContent => !!item) }
  function change<K extends keyof LinkPageSettings>(key: K, value: LinkPageSettings[K]) { setSettings(current => ({ ...current, [key]: value })); setNotice("") }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("")
    let body: LinkPageSettings
    try { body = parseLinkPageSettings(settings) } catch (error) { setError(error instanceof Error ? error.message : "Confira os campos."); return }
    setBusy(true)
    try { await linkEditorRequest("/api/admin/links/settings", "PUT", body); setSaved(body); setSettings(body); setNotice("Página salva."); router.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar a página.") }
    finally { setBusy(false) }
  }
  function updateSelection(group: "featured" | "readings", index: number, patch: Partial<ContentSelection>) {
    change(group, settings[group].map((entry, position) => position === index ? { ...entry, ...patch } : entry))
  }
  function selectionFields(group: "featured" | "readings") {
    return <div className="space-y-3">{settings[group].map((selection, index) => {
      const source = pool.find(item => item.kind === selection.kind && item.id === selection.id)
      return <div key={`${selection.kind}:${selection.id}`} className="rounded-xl border border-neutral-200 p-4 dark:border-white/15">
        <div className="mb-3 flex items-center gap-2"><div className="min-w-0 flex-1"><strong className="block break-words text-sm">{source?.title || "Conteúdo selecionado"}</strong><span className="text-xs text-neutral-500">{selection.kind === "note" ? "Nota" : selection.kind === "post" ? "Texto" : "Link"}</span></div>
          <button type="button" disabled={index === 0} aria-label="Mover seleção para cima" onClick={() => { const next = [...settings[group]]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(group, next) }} className="grid size-10 place-items-center rounded-md disabled:opacity-30"><ArrowUpIcon className="size-4" /></button>
          <button type="button" aria-label="Remover seleção" onClick={() => change(group, settings[group].filter((_, position) => position !== index))} className="grid size-10 place-items-center rounded-md text-red-600"><TrashIcon className="size-4" /></button>
        </div>
        <details><summary className="cursor-pointer text-xs text-neutral-500">Personalizar texto e capa</summary><div className="mt-3 space-y-3">
          <label className="admin-field"><span>Título personalizado (opcional)</span><input maxLength={180} value={selection.title} onChange={event => updateSelection(group, index, { title: event.target.value })} placeholder={source?.title || "Usar o título do conteúdo"} /></label>
          {selection.kind !== "note" && <label className="admin-field"><span>Descrição personalizada (opcional)</span><textarea maxLength={500} rows={3} value={selection.description} onChange={event => updateSelection(group, index, { description: event.target.value })} placeholder="Usar a descrição do conteúdo" /></label>}
          <label className="admin-field"><span>Capa</span><select value={selection.coverMode} onChange={event => updateSelection(group, index, { coverMode: event.target.value as ContentSelection["coverMode"] })}><option value="original">Usar a capa do conteúdo</option><option value="none">Sem capa</option><option value="custom">Escolher outra imagem</option></select></label>
          {selection.coverMode === "custom" && <CoverField onBusyChange={setBusy} url={selection.cover} alt={selection.coverAlt} onChange={(cover, coverAlt) => updateSelection(group, index, { cover, coverAlt })} />}
        </div></details>
      </div>
    })}</div>
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Configurações de links" onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
        const current = buttons.indexOf(event.target as HTMLButtonElement)
        if (current < 0) return
        event.preventDefault()
        const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length
        buttons[index].focus(); buttons[index].click()
      }} className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 dark:bg-white/5">{([["content", "Links"], ["page", "Página e seções"], ["featured", "Destaques e leituras"], ["stats", "Cliques"]] as const).map(([value, label]) => <button key={value} id={`links-tab-${value}`} role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} aria-controls={`links-panel-${value}`} type="button" onClick={() => setTab(value)} className={`min-h-10 shrink-0 rounded-md px-3 text-xs font-medium ${tab === value ? "bg-white shadow-sm dark:bg-neutral-800" : "text-neutral-500"}`}>{label}</button>)}</div>
      <button type="button" className="admin-button-secondary" onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Ocultar prévia" : "Mostrar prévia"}</button>
    </div>
    {error && <p role="alert" className="admin-form-error">{error}</p>}{notice && <p role="status" className="text-sm text-neutral-500">{notice}</p>}
    <div className={showPreview && tab !== "stats" ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]" : ""}>
      <div role="tabpanel" id={`links-panel-${tab}`} aria-labelledby={`links-tab-${tab}`} className="min-w-0">
        <div hidden={tab !== "content"}><LinksEditor links={links} sections={(saved || initialSettings(links)).sections} /></div>
        {(tab === "page" || tab === "featured") && <form onSubmit={save} className="rounded-xl border border-neutral-200 p-5 dark:border-white/15"><fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
          {tab === "page" ? <>
            <h2 className="text-lg font-semibold">Abertura da página</h2>
            <label className="admin-field"><span>Chamada principal</span><textarea rows={4} maxLength={300} value={settings.heading} onChange={event => change("heading", event.target.value)} placeholder="Escreva a abertura. As quebras de linha serão preservadas." /></label>
            <label className="admin-field"><span>Apresentação</span><textarea rows={3} maxLength={500} value={settings.intro} onChange={event => change("intro", event.target.value)} /></label>
            <details><summary className="cursor-pointer text-sm font-medium">Título e descrição para buscas e compartilhamento</summary><div className="mt-3 space-y-3"><label className="admin-field"><span>Título da página</span><input maxLength={180} value={settings.metaTitle} onChange={event => change("metaTitle", event.target.value)} /></label><label className="admin-field"><span>Descrição da página</span><textarea rows={3} maxLength={500} value={settings.metaDescription} onChange={event => change("metaDescription", event.target.value)} /></label></div></details>
            <div className="border-t border-neutral-200 pt-5 dark:border-white/10"><h2 className="mb-3 text-lg font-semibold">Seções</h2><p className="mb-4 text-xs leading-relaxed text-neutral-500">Renomeie os grupos e escolha links em linha ou cartões. Mova os links antes de excluir uma seção.</p>
              <div className="space-y-3">{settings.sections.map((section, index) => <div key={section.id} className="rounded-lg border border-neutral-200 p-3 dark:border-white/15">
                <label className="admin-field"><span>Nome da seção</span><input required maxLength={80} value={section.title} onChange={event => change("sections", settings.sections.map((item, position) => position === index ? { ...item, title: event.target.value } : item))} /></label>
                <div className="mt-2 flex items-end gap-2"><label className="admin-field min-w-0 flex-1"><span>Apresentação</span><select value={section.layout} onChange={event => change("sections", settings.sections.map((item, position) => position === index ? { ...item, layout: event.target.value as "row" | "cards" } : item))}><option value="row">Links em linha</option><option value="cards">Cartões</option></select></label>
                  <button type="button" disabled={index === 0} aria-label={`Subir seção ${section.title}`} onClick={() => { const next = [...settings.sections]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change("sections", next) }} className="grid size-11 place-items-center disabled:opacity-30"><ArrowUpIcon className="size-4" /></button>
                  <button type="button" disabled={index === settings.sections.length - 1} aria-label={`Descer seção ${section.title}`} onClick={() => { const next = [...settings.sections]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; change("sections", next) }} className="grid size-11 place-items-center disabled:opacity-30"><ArrowDownIcon className="size-4" /></button>
                  <button type="button" disabled={links.some(link => link.section === section.id)} aria-label={`Excluir seção ${section.title}`} onClick={() => change("sections", settings.sections.filter(item => item.id !== section.id))} className="grid size-11 place-items-center text-red-600 disabled:opacity-30"><TrashIcon className="size-4" /></button>
                </div>
              </div>)}</div>
              <button type="button" className="admin-button-secondary mt-3" disabled={settings.sections.length >= 20} onClick={() => change("sections", [...settings.sections, { id: `section-${crypto.randomUUID().slice(0, 8)}`, title: "", layout: "row" }])}>Adicionar seção</button>
            </div>
          </> : <>
            <h2 className="text-lg font-semibold">Carrossel de destaques</h2>
            <label className="admin-field"><span>Título da seção</span><input maxLength={100} value={settings.featuredHeading} onChange={event => change("featuredHeading", event.target.value)} /></label>
            <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={settings.includeLatest} onChange={event => change("includeLatest", event.target.checked)} className="mt-1 size-4" /><span>Incluir o texto ou nota mais recente automaticamente.<small className="mt-1 block text-xs text-neutral-500">A publicação mais nova aparece primeiro, seguida das duas escolhas abaixo. Conteúdos repetidos aparecem uma vez.</small></span></label>
            {selectionFields("featured")}
            <button type="button" disabled={settings.featured.length >= 2} className="admin-button-secondary" onClick={() => setPicker("featured")}>Escolher destaque ({settings.featured.length}/2)</button>
            <div className="space-y-4 border-t border-neutral-200 pt-5 dark:border-white/10"><h2 className="text-lg font-semibold">Leituras fixas</h2><label className="admin-field"><span>Título da seção</span><input maxLength={100} value={settings.readingsHeading} onChange={event => change("readingsHeading", event.target.value)} /></label><p className="text-xs leading-relaxed text-neutral-500">Escolha textos, notas ou links cadastrados. A seleção permanece até você alterá-la.</p>{selectionFields("readings")}<button type="button" disabled={settings.readings.length >= 20} className="admin-button-secondary" onClick={() => setPicker("readings")}>Adicionar leitura</button></div>
          </>}
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4 dark:border-white/10"><button type="submit" className="admin-button-primary">{busy ? "Salvando…" : "Salvar página"}</button>{JSON.stringify(settings) !== JSON.stringify(saved) && <span className="text-xs text-neutral-500">Alterações ainda não publicadas</span>}</div>
        </fieldset></form>}
        {tab === "stats" && <LinkStats content={pool} links={links} />}
      </div>
      {showPreview && tab !== "stats" && <aside className="min-w-0 rounded-xl border border-neutral-200 p-5 xl:sticky xl:top-5 dark:border-white/15"><h2 className="mb-4 text-sm font-semibold">Prévia ao vivo</h2><div className="max-h-[80dvh] overflow-y-auto"><LinksPageView data={preview} links={links} preview /></div></aside>}
    </div>
    {picker && <ContentPicker allowLinks={picker === "readings"} onClose={() => setPicker(null)} onSelect={content => {
      const group = picker
      if (!group) return
      if (settings[group].some(item => item.kind === content.kind && item.id === content.id)) { setError("Esse conteúdo já está nesta seleção."); return }
      setPool(current => [content, ...current.filter(item => item.kind !== content.kind || item.id !== content.id)])
      change(group, [...settings[group], contentSelection(content)]); setError("")
    }} />}
  </div>
}
