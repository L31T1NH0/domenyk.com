"use client"

import NextLink from "next/link"
import { useId } from "react"
import { ChatBubbleLeftRightIcon, DocumentTextIcon, EyeIcon, UsersIcon, PencilSquareIcon, ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, CalendarDaysIcon } from "@heroicons/react/24/outline"
import type { loadAdminDashboard } from "../data"
import { buttonVariants, Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = Awaited<ReturnType<typeof loadAdminDashboard>>
const number = (value: number) => value.toLocaleString("pt-BR")
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" })
const linkStyle = "rounded-sm font-medium hover:underline underline-offset-4 break-words"

export function Overview({ total, activity }: Props) {
  const chartId = useId()
  const max = Math.max(1, ...activity.days.map(day => day.views))
  const x = (index: number) => 16 + index / Math.max(1, activity.days.length - 1) * 768
  const y = (value: number) => 220 - value / max * 192
  const points = activity.days.map((day, i) => `${x(i)},${y(day.views)}`).join(" ")
  const metrics = [
    { label: "Leituras", value: activity.totals.views, detail: "Nos últimos 14 dias", icon: EyeIcon },
    { label: "Visitantes", value: activity.totals.visitors, detail: "Pessoas que chegaram até aqui", icon: UsersIcon },
    { label: "Comentários", value: activity.totals.comments, detail: "Conversas nos últimos 14 dias", icon: ChatBubbleLeftRightIcon },
    { label: "Posts no acervo", value: total, detail: "Publicados e rascunhos", icon: DocumentTextIcon },
  ]

  function recentActivity(events: Props["activity"]["recent"]) {
    return events.map(event => <li key={event.id} className="flex min-w-0 gap-3 py-4 first:pt-0 last:pb-0">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-admin-border bg-admin-muted">
        {event.type === "post_view" ? <EyeIcon className="size-4" /> : <ChatBubbleLeftRightIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium">{event.type === "post_view" ? "Nova leitura" : "Novo comentário"}</p>
          <time dateTime={event.occurredAt} className="text-xs text-admin-muted-foreground">{new Date(event.occurredAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
        </div>
        <p className="text-sm">{event.postSlug ? <NextLink className={linkStyle} href={`/posts/${event.postSlug}`} target="_blank" rel="noopener noreferrer">{event.postTitle ?? "Ver post"}<span className="sr-only"> (abre em outra aba)</span></NextLink> : event.postTitle ?? "Conteúdo removido"}</p>
        <p className="text-xs text-admin-muted-foreground">{event.isAuthenticated ? event.userName ?? "Pessoa identificada" : "Visitante anônimo"}</p>
      </div>
    </li>)
  }

  return <div className="space-y-6 text-admin-foreground">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Visão geral</h1>
        <p className="max-w-prose text-sm text-admin-muted-foreground">Suas publicações e o movimento dos leitores, em um só lugar.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <NextLink href="/admin/notes" className={buttonVariants({ variant: "outline" })}>Ver notas</NextLink>
        <NextLink href="/admin/posts/new" className={buttonVariants()}><PencilSquareIcon aria-hidden="true" />Escrever post</NextLink>
      </div>
    </header>

    <section aria-label="Indicadores do painel" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, detail, icon: Icon }) => <Card key={label}>
        <CardHeader><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-admin-muted-foreground">{label}</h2><Icon aria-hidden="true" className="size-4 text-admin-muted-foreground" /></div></CardHeader>
        <CardContent><p className="text-3xl font-semibold tracking-tight tabular-nums">{number(value)}</p><p className="mt-2 text-xs text-admin-muted-foreground">{detail}</p></CardContent>
      </Card>)}
    </section>

    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Leituras ao longo do tempo</CardTitle><p className="flex items-center gap-2 text-xs text-admin-muted-foreground"><CalendarDaysIcon aria-hidden="true" className="size-4" />Últimos 14 dias</p></div>
        <CardDescription>{number(activity.totals.views)} leituras e {number(activity.totals.authenticated)} ações de pessoas identificadas no período.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.days.length ? <figure>
          <svg viewBox="0 0 800 240" className="block w-full" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
            <title id={`${chartId}-title`}>Leituras diárias nos últimos 14 dias</title>
            <desc id={`${chartId}-description`}>Total de {number(activity.totals.views)} leituras. Os valores de cada dia estão disponíveis na tabela Dados do período.</desc>
            <defs><linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--admin-chart)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--admin-chart)" stopOpacity="0" /></linearGradient></defs>
            {[0, 1, 2, 3].map(i => <path key={i} d={`M16 ${28 + i * 64}H784`} fill="none" stroke="var(--admin-border)" strokeDasharray="4 6" />)}
            {activity.days.length > 1 && <polygon points={`16,220 ${points} 784,220`} fill={`url(#${chartId}-fill)`} />}
            <polyline points={points} fill="none" stroke="var(--admin-chart)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {activity.days.map((day, i) => <circle key={day.date} cx={x(i)} cy={y(day.views)} r="3" fill="var(--admin-chart)"><title>{`${dayLabel(day.date)}: ${number(day.views)} leituras`}</title></circle>)}
          </svg>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-admin-muted-foreground">
            <span>{dayLabel(activity.days[0].date)}</span><span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-admin-chart" />Leituras por dia</span><span>{dayLabel(activity.days[activity.days.length - 1].date)}</span>
          </figcaption>
          {activity.totals.views === 0 && <p className="mt-4 text-sm text-admin-muted-foreground">As primeiras leituras aparecerão aqui.</p>}
        </figure> : <p className="py-12 text-center text-sm text-admin-muted-foreground">Ainda não há dados de leitura neste período.</p>}
        <details className="mt-6 border-t border-admin-border pt-4">
          <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium">Dados do período</summary>
          <div role="region" aria-label="Leituras e comentários por dia" tabIndex={0} className="mt-4 max-h-80 overflow-auto overscroll-contain rounded-md border border-admin-border">
            <Table><caption className="sr-only">Leituras e comentários nos últimos 14 dias</caption><TableHeader><TableRow><TableHead>Dia</TableHead><TableHead className="text-end">Leituras</TableHead><TableHead className="text-end">Comentários</TableHead></TableRow></TableHeader>
              <TableBody>{activity.days.map(day => <TableRow key={day.date}><TableHead scope="row" className="whitespace-nowrap">{dayLabel(day.date)}</TableHead><TableCell className="text-end tabular-nums">{number(day.views)}</TableCell><TableCell className="text-end tabular-nums">{number(day.comments)}</TableCell></TableRow>)}</TableBody>
            </Table>
            {!activity.days.length && <p className="p-4 text-sm text-admin-muted-foreground">Nenhum dado no período.</p>}
          </div>
        </details>
      </CardContent>
    </Card>

    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Mais lidos</CardTitle><NextLink href="/admin/posts" className={buttonVariants({ variant: "ghost", size: "sm" })}>Todos os posts<ArrowTopRightOnSquareIcon aria-hidden="true" /></NextLink></div><CardDescription>Posts com mais leituras nos últimos 14 dias.</CardDescription></CardHeader>
        <CardContent>
          {activity.topPosts.length ? <div role="region" aria-label="Posts mais lidos" tabIndex={0} className="max-h-96 overflow-auto overscroll-contain">
            <Table><caption className="sr-only">Posts mais lidos nos últimos 14 dias</caption><TableHeader><TableRow><TableHead>Publicação</TableHead><TableHead className="text-end">Leituras</TableHead><TableHead className="text-end">Comentários</TableHead></TableRow></TableHeader>
              <TableBody>{activity.topPosts.map(post => <TableRow key={post.publicId}><TableCell className="min-w-40"><NextLink href={`/posts/${post.slug}`} className={linkStyle} target="_blank" rel="noopener noreferrer">{post.title}<span className="sr-only"> (abre em outra aba)</span></NextLink></TableCell><TableCell className="text-end font-medium tabular-nums">{number(post.views)}</TableCell><TableCell className="text-end tabular-nums text-admin-muted-foreground">{number(post.comments)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div> : <p className="py-10 text-center text-sm text-admin-muted-foreground">As primeiras leituras aparecerão aqui.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Atividade recente</CardTitle><NextLink href="/admin/comments" className={buttonVariants({ variant: "ghost", size: "sm" })}>Comentários</NextLink></div><CardDescription>As últimas leituras e conversas do site.</CardDescription></CardHeader>
        <CardContent>
          {activity.recent.length ? <ol className="divide-y divide-admin-border">{recentActivity(activity.recent.slice(0, 5))}</ol> : <p className="py-10 text-center text-sm text-admin-muted-foreground">Nenhuma atividade recente.</p>}
          {activity.recent.length > 5 && <details className="mt-5 border-t border-admin-border pt-4"><summary className="w-fit cursor-pointer rounded-sm text-sm font-medium">Ver mais atividades</summary><ol className="mt-5 divide-y divide-admin-border">{recentActivity(activity.recent.slice(5))}</ol></details>}
        </CardContent>
      </Card>
    </div>

    <details className="rounded-xl border border-admin-border bg-admin-card p-5">
      <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium">Acervo e backup</summary>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
        <dl className="flex flex-wrap gap-6 text-sm"><div><dt className="text-admin-muted-foreground">Posts no acervo</dt><dd className="mt-1 font-medium tabular-nums">{number(total)}</dd></div><div><dt className="text-admin-muted-foreground">Ações autenticadas no período</dt><dd className="mt-1 font-medium tabular-nums">{number(activity.totals.authenticated)}</dd></div></dl>
        <form method="post" action="/api/admin/database/download"><Button type="submit" variant="outline"><ArrowDownTrayIcon aria-hidden="true" />Baixar backup do banco</Button></form>
      </div>
    </details>
  </div>
}
