"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, ArrowTopRightOnSquareIcon, ArrowUpIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline"
import { LinkIcon } from "@/components/links/LinkIcon"
import { LINK_ICONS, canonicalLinkURL, normalizeLinkURL, suggestLinkTitle, parseLinkInput, type LinkInput, type SiteLink } from "@/lib/links"
import type { LinkSection } from "@/lib/link-page"
import { ContentPicker, CoverField, linkEditorRequest } from "./LinkEditorControls"

const emptyLink: LinkInput = { title: "", description: "", url: "", icon: "favicon", section: "", order: 0, published: true, appearance: "simple", cover: "", coverAlt: "", startsAt: null, endsAt: null }
const healthNames: Record<string, string> = { ok: "Endereço respondeu", broken: "Link indisponível", unknown: "Não foi possível confirmar" }
function dateInput(value: string | null) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function LinksEditor({ links, sections }: { links: SiteLink[]; sections: LinkSection[] }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  function nextOrder(section: string) { return Math.min(10000, Math.max(-1, ...links.filter(link => link.section === section).map(link => link.order)) + 1) }
  const [input, setInput] = useState<LinkInput>(() => ({ ...emptyLink, section: sections[0]?.id ?? "", order: nextOrder(sections[0]?.id ?? "") }))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [now] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [iconSearch, setIconSearch] = useState("")
  const [picker, setPicker] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [addresses, setAddresses] = useState("")
  const [dragged, setDragged] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, string>>({})
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  const visibleIcons = (Object.entries(LINK_ICONS) as [LinkInput["icon"], string][]).filter(([icon, label]) => normalize(`${icon} ${label}`).includes(normalize(iconSearch)))
  const sectionId = sections.some(section => section.id === input.section) ? input.section : sections[0]?.id ?? ""
  const existingURLs = new Set(links.map(link => canonicalLinkURL(link.url)))
  const batchSeen = new Set<string>()
  const batch = addresses.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 50).map(raw => {
    const url = normalizeLinkURL(raw), key = canonicalLinkURL(url), duplicate = existingURLs.has(key) || batchSeen.has(key)
    batchSeen.add(key)
    let valid = true
    try { parseLinkInput({ ...emptyLink, title: suggestLinkTitle(url) || url.slice(0, 100), section: sectionId, url }) } catch { valid = false }
    return { raw, url, duplicate, valid }
  })
  function reset(saved?: LinkInput) {
    const section = saved?.section ?? sections[0]?.id ?? ""
    setInput({ ...emptyLink, section, order: Math.min(10000, Math.max(nextOrder(section), saved ? saved.order + 1 : 0)) }); setEditingId(null); setError(""); setIconSearch("")
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("")
    let body: LinkInput
    try { body = parseLinkInput({ ...input, section: sectionId, url: normalizeLinkURL(input.url), title: input.title.trim() || suggestLinkTitle(input.url) }) }
    catch (error) { setError(error instanceof Error ? error.message : "Confira os campos."); return }
    const unchangedURL = editingId && links.find(link => link.id === editingId)?.url === body.url
    if (!unchangedURL && links.some(link => link.id !== editingId && canonicalLinkURL(link.url) === canonicalLinkURL(body.url))) { setError("Esse endereço já está cadastrado. Edite o link existente."); return }
    setBusy(true)
    try { await linkEditorRequest(`/api/admin/links${editingId ? `/${editingId}` : ""}`, editingId ? "PATCH" : "POST", body); reset(body); setNotice("Link salvo."); router.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar o link.") }
    finally { setBusy(false) }
  }
  async function saveBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true)
    const pending = batch.filter(item => item.valid && !item.duplicate)
    const completed = new Set<string>()
    try {
      let order = nextOrder(sectionId)
      for (const item of pending) {
        const body = parseLinkInput({ ...emptyLink, section: sectionId, url: item.url, title: suggestLinkTitle(item.url) || item.url.slice(0, 100), order: Math.min(10000, order++) })
        await linkEditorRequest("/api/admin/links", "POST", body); completed.add(item.raw)
      }
      setNotice(`${completed.size} link${completed.size === 1 ? " adicionado" : "s adicionados"}.`)
    } catch (error) { setError(`${error instanceof Error ? error.message : "Falha ao adicionar links."} ${completed.size} já foram salvos; os demais continuam abaixo.`) }
    finally { setAddresses(current => current.split(/\r?\n/).filter(line => !completed.has(line.trim())).join("\n")); setBusy(false); router.refresh() }
  }
  async function remove(link: SiteLink) {
    if (!window.confirm(`Excluir “${link.title}”?`)) return
    setBusy(true); setError(""); setNotice("")
    try { await linkEditorRequest(`/api/admin/links/${link.id}`, "DELETE"); if (editingId === link.id) reset(); setNotice("Link excluído."); router.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível excluir o link.") }
    finally { setBusy(false) }
  }
  async function reorder(fromId: string, target: SiteLink) {
    if (busy || fromId === target.id) return
    const ordered = sections.flatMap(section => links.filter(link => link.section === section.id).sort((a, b) => a.order - b.order))
    const from = ordered.findIndex(link => link.id === fromId), to = ordered.findIndex(link => link.id === target.id)
    if (from < 0 || to < 0) return
    const [moved] = ordered.splice(from, 1); ordered.splice(to, 0, { ...moved, section: target.section })
    const positions: Record<string, number> = {}
    const items = ordered.map(link => ({ id: link.id, section: link.section, order: positions[link.section] = (positions[link.section] ?? -1) + 1 }))
    setBusy(true); setError("")
    try { await linkEditorRequest("/api/admin/links/order", "PUT", { items }); setNotice("Ordem atualizada."); router.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível alterar a ordem.") }
    finally { setBusy(false); setDragged(null) }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2"><button type="button" className={bulk ? "admin-button-secondary" : "admin-button-primary"} onClick={() => setBulk(false)}>Adicionar link</button><button type="button" className="admin-button-secondary" onClick={() => setPicker(true)}>Do meu site</button><button type="button" className={bulk ? "admin-button-primary" : "admin-button-secondary"} onClick={() => setBulk(true)}>Vários links</button></div>
    {!sections.length && <p role="status" className="text-sm text-neutral-500">Crie e salve uma seção em “Página e seções” para adicionar links.</p>}
    {bulk ? <form onSubmit={saveBatch} className="rounded-xl border border-neutral-200 p-5 dark:border-white/15"><fieldset disabled={busy || !sections.length} className="space-y-4"><legend className="mb-3 font-semibold">Adicionar vários links</legend>
      <label className="admin-field"><span>Cole um endereço por linha</span><textarea rows={6} value={addresses} onChange={event => setAddresses(event.target.value)} placeholder="Um endereço por linha, até 50 por vez" /></label>
      <label className="admin-field"><span>Seção</span><select value={sectionId} onChange={event => setInput({ ...input, section: event.target.value })}>{sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>
      <ul className="space-y-2">{batch.map((item, index) => <li key={index} className="flex items-center gap-2 break-all text-xs"><LinkIcon name="favicon" url={item.url} className="size-4 shrink-0" /><span className="min-w-0 flex-1">{item.url}</span><span className={item.duplicate || !item.valid ? "shrink-0 text-amber-700 dark:text-amber-400" : "shrink-0 text-neutral-500"}>{!item.valid ? "Inválido" : item.duplicate ? "Repetido" : "Pronto"}</span></li>)}</ul>
      <p className="text-xs text-neutral-500">Links repetidos ou inválidos serão ignorados. Os links são criados públicos, com favicon; você pode editá-los depois.</p><button type="submit" disabled={!batch.some(item => item.valid && !item.duplicate)} className="admin-button-primary">{busy ? "Adicionando…" : `Adicionar ${batch.filter(item => item.valid && !item.duplicate).length} links`}</button>
    </fieldset></form> : <form ref={formRef} onSubmit={save} className="rounded-xl border border-neutral-200 p-5 dark:border-white/15"><fieldset disabled={busy || !sections.length} className="space-y-4 disabled:opacity-60"><legend className="mb-3 text-base font-semibold">{editingId ? "Editar link" : "Adicionar link"}</legend>
      <label className="admin-field"><span>Endereço do link</span><input required maxLength={2048} value={input.url} onChange={event => setInput({ ...input, url: event.target.value })} onBlur={() => setInput(current => ({ ...current, url: normalizeLinkURL(current.url), title: current.title.trim() ? current.title : suggestLinkTitle(current.url) }))} placeholder="Cole o endereço para começar" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><small>Domínios sem protocolo recebem HTTPS. O favicon vem do site.</small></label>
      <div className="admin-form-grid"><label className="admin-field"><span>Título</span><input ref={titleRef} maxLength={100} value={input.title} onChange={event => setInput({ ...input, title: event.target.value })} /></label><label className="admin-field"><span>Seção</span><select value={sectionId} onChange={event => setInput({ ...input, section: event.target.value, order: editingId ? input.order : nextOrder(event.target.value) })}>{sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div>
      <details><summary className="cursor-pointer text-sm font-medium">Ícone: {LINK_ICONS[input.icon]}</summary><div className="mt-3 space-y-3"><label className="admin-field"><span className="sr-only">Buscar ícone</span><input type="search" value={iconSearch} onChange={event => setIconSearch(event.target.value)} placeholder="Buscar ícone…" /></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleIcons.map(([icon, label]) => <button key={icon} type="button" aria-pressed={input.icon === icon} onClick={() => setInput({ ...input, icon })} className={`flex min-h-12 items-center gap-2 rounded-lg border p-2 text-left text-xs ${input.icon === icon ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-200 dark:border-white/15"}`}><LinkIcon name={icon} url={normalizeLinkURL(input.url)} className="size-5 shrink-0" />{label}</button>)}</div>{!visibleIcons.length && <p className="text-xs text-neutral-500">Nenhum ícone encontrado.</p>}</div></details>
      <label className="admin-field"><span>Apresentação</span><select value={input.appearance} onChange={event => setInput({ ...input, appearance: event.target.value as LinkInput["appearance"] })}><option value="simple">Link simples</option><option value="description">Com descrição</option><option value="image">Com imagem</option></select></label>
      {input.appearance !== "simple" && <label className="admin-field"><span>Descrição (opcional)</span><textarea maxLength={180} rows={3} value={input.description} onChange={event => setInput({ ...input, description: event.target.value })} /></label>}
      {input.appearance === "image" && <CoverField onBusyChange={setBusy} url={input.cover} alt={input.coverAlt} onChange={(cover, coverAlt) => setInput(current => ({ ...current, cover, coverAlt }))} />}
      <details onInvalid={event => { event.currentTarget.open = true }}><summary className="cursor-pointer text-sm font-medium">Publicação e ordem</summary><div className="mt-3 space-y-3"><label className="admin-field"><span>Publicar a partir de</span><input type="datetime-local" value={dateInput(input.startsAt)} onChange={event => setInput({ ...input, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label><label className="admin-field"><span>Ocultar a partir de</span><input type="datetime-local" value={dateInput(input.endsAt)} onChange={event => setInput({ ...input, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label><p className="text-xs text-neutral-500">Horários locais do seu navegador. Deixe vazio para publicar sem prazo.</p><label className="admin-field"><span>Ordem</span><input type="number" min={0} max={10000} step={1} required value={Number.isNaN(input.order) ? "" : input.order} onChange={event => setInput({ ...input, order: event.target.valueAsNumber })} /></label></div></details>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={input.published} onChange={event => setInput({ ...input, published: event.target.checked })} className="size-4" />Habilitar publicação</label>
      <div className="flex flex-wrap gap-2"><button type="submit" className="admin-button-primary">{busy ? "Aguarde…" : editingId ? "Salvar alterações" : "Adicionar link"}</button>{editingId && <button type="button" className="admin-button-secondary" onClick={() => reset()}>Cancelar edição</button>}</div>
    </fieldset></form>}
    {error && <p role="alert" className="admin-form-error">{error}</p>}{notice && <p role="status" className="text-sm text-neutral-500">{notice}</p>}
    <section aria-label="Links cadastrados" className="space-y-4"><div><h2 className="text-base font-semibold">Seus links</h2><p className="text-xs text-neutral-500">Arraste para ordenar ou use as setas. {links.length} cadastrado(s).</p></div>
      {!links.length && <p className="admin-empty">Adicione seu primeiro link pelo formulário acima.</p>}
      {sections.map(section => {
        const items = links.filter(link => link.section === section.id).sort((a, b) => a.order - b.order)
        if (!items.length) return null
        return <div key={section.id}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{section.title}</h3><ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-white/10 dark:border-white/15">{items.map((link, index) => {
          const duplicate = links.some(other => other.id !== link.id && canonicalLinkURL(other.url) === canonicalLinkURL(link.url))
          return <li key={link.id} draggable={!busy} onDragStart={event => { setDragged(link.id); event.dataTransfer.setData("text/plain", link.id) }} onDragEnd={() => setDragged(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged) void reorder(dragged, link) }} className={`flex flex-wrap items-center gap-3 p-3 ${dragged === link.id ? "opacity-50" : ""}`}>
            <span aria-hidden="true" className="cursor-grab text-neutral-400">⠿</span><LinkIcon name={link.icon} url={link.url} className="size-5 shrink-0" /><div className="min-w-0 flex-1 basis-28"><strong className="block break-words text-sm">{link.title}</strong><span className="block break-all text-xs text-neutral-500">{link.url}</span><span className="mt-1 block text-xs text-neutral-500">{!link.published ? "Oculto" : link.startsAt && Date.parse(link.startsAt) > now ? "Agendado" : link.endsAt && Date.parse(link.endsAt) <= now ? "Encerrado" : "Público"}{duplicate && " · Repetido"}{(checks[link.id] || link.health) && ` · ${healthNames[checks[link.id] || link.health || ""] || "Não verificado"}`}</span></div>
            <div className="flex flex-wrap items-center gap-0.5"><button type="button" disabled={busy || index === 0} aria-label={`Subir ${link.title}`} onClick={() => void reorder(link.id, items[index - 1])} className="grid size-10 place-items-center disabled:opacity-30"><ArrowUpIcon className="size-4" /></button><button type="button" disabled={busy || index === items.length - 1} aria-label={`Descer ${link.title}`} onClick={() => void reorder(link.id, items[index + 1])} className="grid size-10 place-items-center disabled:opacity-30"><ArrowDownIcon className="size-4" /></button>
              <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${link.title}`} className="grid size-10 place-items-center"><ArrowTopRightOnSquareIcon className="size-4" /></a><button type="button" disabled={busy} aria-label={`Editar ${link.title}`} onClick={() => { setBulk(false); setEditingId(link.id); setInput(parseLinkInput(link)); setIconSearch(""); setError(""); setNotice(""); formRef.current?.scrollIntoView({ block: "start" }); titleRef.current?.focus({ preventScroll: true }) }} className="grid size-10 place-items-center disabled:opacity-30"><PencilSquareIcon className="size-4" /></button><button type="button" disabled={busy} aria-label={`Excluir ${link.title}`} onClick={() => void remove(link)} className="grid size-10 place-items-center text-red-600 disabled:opacity-30"><TrashIcon className="size-4" /></button>
              <button type="button" disabled={busy} className="min-h-10 px-2 text-xs underline underline-offset-4 disabled:opacity-30" onClick={async () => { setBusy(true); setError(""); try { const result = await linkEditorRequest<{ health: string }>(`/api/admin/links/${link.id}/check`, "POST", {}); setChecks(current => ({ ...current, [link.id]: result.health })); router.refresh() } catch (error) { setError(error instanceof Error ? error.message : "Falha na verificação.") } finally { setBusy(false) } }}>Verificar</button>
            </div>
          </li>
        })}</ul></div>
      })}
    </section>
    {picker && <ContentPicker onClose={() => setPicker(false)} onSelect={content => { setBulk(false); setEditingId(null); setInput({ ...emptyLink, section: sections[0]?.id ?? "", order: nextOrder(sections[0]?.id ?? ""), title: content.title.slice(0, 100), description: content.description.slice(0, 180), url: content.url, icon: content.kind === "post" ? "document" : "book", cover: content.cover, coverAlt: content.coverAlt.slice(0, 180), appearance: content.cover ? "image" : "description" }) }} />}
  </div>
}
