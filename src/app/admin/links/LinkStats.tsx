"use client"

import { useEffect, useState } from "react"
import type { LinkContent } from "@/lib/link-page"
import type { SiteLink } from "@/lib/links"
type Stats = { days: number; items: { kind: string; id: string; clicks: number }[]; daily: { day: string; clicks: number }[] }
export function LinkStats({ content, links }: { content: LinkContent[]; links: SiteLink[] }) {
  const [days, setDays] = useState("7")
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/admin/links/stats?days=${days}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as Stats
    }).then(data => { setStats(data); setError("") }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível carregar os cliques.") })
    return () => controller.abort()
  }, [days])
  return <section className="space-y-5 rounded-xl border border-neutral-200 p-5 dark:border-white/15"><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-lg font-semibold">Cliques na página de links</h2><label className="admin-field"><span>Período</span><select value={days} onChange={event => { setDays(event.target.value); setStats(null) }}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label></div>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    {!stats && !error && <p role="status" className="text-sm text-neutral-500">Carregando cliques…</p>}
    {stats && <><p className="text-4xl font-semibold tabular-nums">{stats.items.reduce((sum, item) => sum + item.clicks, 0)} <span className="text-sm font-normal text-neutral-500">cliques no período</span></p>
      {stats.daily.length > 0 && <ul className="flex h-32 items-end gap-1" aria-label="Cliques por dia">{stats.daily.map(item => <li key={item.day} className="min-w-0 flex-1 text-center"><div className="mx-auto w-full max-w-8 rounded-t bg-neutral-800 dark:bg-neutral-200" style={{ height: `${Math.max(2, item.clicks / Math.max(...stats.daily.map(day => day.clicks)) * 100)}px` }} title={`${item.day}: ${item.clicks} cliques`} /><span className="sr-only">{item.day}: {item.clicks} cliques</span></li>)}</ul>}
      {stats.items.length > 0 && <ul className="divide-y divide-neutral-200 dark:divide-white/10">{[...stats.items].sort((a, b) => b.clicks - a.clicks).map(item => {
        const source = content.find(entry => entry.kind === item.kind && entry.id === item.id)
        const link = item.kind === "link" ? links.find(entry => entry.id === item.id) : null
        return <li key={`${item.kind}:${item.id}`} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 break-words text-sm">{source?.title || link?.title || "Conteúdo removido ou fora dos resultados recentes"}<small className="mt-1 block text-xs text-neutral-500">{source?.url || link?.url || item.id}</small></span><strong className="text-sm tabular-nums">{item.clicks}</strong></li>
      })}</ul>}
      {!stats.items.length && <p className="text-sm text-neutral-500">Ainda não há cliques registrados neste período.</p>}
      <p className="text-xs leading-relaxed text-neutral-500">Conta as aberturas feitas pela página pública, incluindo destaques e leituras. A prévia do painel não registra cliques. Os valores são totais, não visitantes únicos.</p>
    </>}
  </section>
}
