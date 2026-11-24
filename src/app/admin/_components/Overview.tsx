"use client"

import { useId } from "react"
import { Card } from "@astryxdesign/core/Card"
import { ChatBubbleLeftRightIcon, DocumentTextIcon, EyeIcon, UsersIcon } from "@heroicons/react/24/outline"
import type { loadAdminDashboard } from "../data"
import { Button, Disclosure, Empty, Facts, Grid, HStack, Link, PageHeader, Panel, Table, TableRegion, Text, VStack } from "./ui"

type Props = Awaited<ReturnType<typeof loadAdminDashboard>>
const number = (value: number) => value.toLocaleString("pt-BR")

export function Overview({ total, activity }: Props) {
  const chartId = useId()
  const max = Math.max(1, ...activity.days.map(day => day.views))
  const points = activity.days.map((day, i) => `${48 + i / Math.max(1, activity.days.length - 1) * 872},${220 - day.views / max * 180}`).join(" ")
  const metrics = [
    { label: "Leituras", value: activity.totals.views, detail: "Nos últimos 14 dias", icon: EyeIcon },
    { label: "Visitantes", value: activity.totals.visitors, detail: "Pessoas que chegaram até aqui", icon: UsersIcon },
    { label: "Comentários", value: activity.totals.comments, detail: "Conversas no período", icon: ChatBubbleLeftRightIcon },
    { label: "Posts no acervo", value: total, detail: "Publicados e rascunhos", icon: DocumentTextIcon },
  ]
  const recentActivity = (events: Props["activity"]["recent"]) => events.map(event => <HStack as="li" key={event.id} gap={3} vAlign="start" paddingBlock={3} className="border-b border-border last:border-0">
    <HStack className="rounded-lg bg-background-muted p-2" aria-hidden="true">
      {event.type === "post_view" ? <EyeIcon className="size-4" /> : <ChatBubbleLeftRightIcon className="size-4" />}
    </HStack>
    <VStack gap={1} className="min-w-0 flex-1">
      <Text type="label">{event.type === "post_view" ? "Nova leitura" : "Novo comentário"}</Text>
      {event.postSlug ? <Link href={`/posts/${event.postSlug}`} target="_blank">{event.postTitle ?? "Ver post"}</Link> : <Text>{event.postTitle ?? "Conteúdo removido"}</Text>}
      <Text type="supporting" color="secondary">{event.isAuthenticated ? event.userName ?? "Pessoa identificada" : "Visitante anônimo"}</Text>
      <Text type="supporting" color="secondary">{new Date(event.occurredAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Text>
    </VStack>
  </HStack>)
  return <VStack gap={6}>
    <PageHeader title="Visão geral" description="Acompanhe suas publicações e o movimento dos leitores."
      actions={<HStack gap={2}><Button label="Ver notas" href="/admin/notes" /><Button label="Escrever post" variant="primary" href="/admin/posts/new" /></HStack>} />
    <Grid columns={{ minWidth: 200, max: 4 }} gap={4}>
      {metrics.map(({ label, value, detail, icon: Icon }) => <Card key={label}>
        <VStack gap={4}>
          <HStack hAlign="between"><Text type="label" color="secondary">{label}</Text><Icon aria-hidden="true" className="size-5 text-icon-secondary" /></HStack>
          <Text type="display-3" className="tabular-nums font-semibold">{number(value)}</Text>
          <Text type="supporting" color="secondary">{detail}</Text>
        </VStack>
      </Card>)}
    </Grid>
    <Panel title="Leituras ao longo do tempo" actions={<Text type="supporting" color="secondary">Últimos 14 dias</Text>}>
      <HStack gap={6} wrap="wrap" vAlign="end">
        <VStack gap={1}><Text type="display-3" className="tabular-nums">{number(activity.totals.views)}</Text><Text color="secondary">leituras no período</Text></VStack>
        <Text color="secondary">{number(activity.totals.authenticated)} ações de pessoas identificadas</Text>
      </HStack>
      <figure className="min-w-0">
        <svg viewBox="0 0 960 260" className="w-full" role="img" aria-labelledby={`${chartId}-title`}>
          <title id={`${chartId}-title`}>Leituras diárias nos últimos 14 dias. Consulte os valores em Dados do período.</title>
          <defs><linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" /></linearGradient></defs>
          {[0, 1, 2, 3].map(i => <g key={i}><path d={`M48 ${40 + i * 60}H920`} fill="none" stroke="var(--color-border)" strokeDasharray="4 6" /><text x="0" y={45 + i * 60} fill="var(--color-text-secondary)" fontSize="12">{number(Math.round(max * (3 - i) / 3))}</text></g>)}
          {activity.days.length > 1 && <polygon points={`48,220 ${points} 920,220`} fill={`url(#${chartId}-fill)`} />}
          <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {activity.days.map((day, i) => <circle key={day.date} cx={48 + i / Math.max(1, activity.days.length - 1) * 872} cy={220 - day.views / max * 180} r="3" fill="var(--color-accent)"><title>{`${day.date}: ${number(day.views)} leituras`}</title></circle>)}
        </svg>
        <figcaption><HStack hAlign="between"><Text type="supporting" color="secondary">Há 14 dias</Text><HStack gap={2}><EyeIcon aria-hidden="true" className="size-4 text-icon-accent" /><Text type="supporting" color="secondary">Leituras por dia</Text></HStack><Text type="supporting" color="secondary">Hoje</Text></HStack></figcaption>
      </figure>
      <Disclosure title="Dados do período">
        <TableRegion label="Leituras e comentários por dia"><Table data={activity.days} idKey="date" columns={[
          { key: "date", header: "Dia" }, { key: "views", header: "Leituras", align: "end" }, { key: "comments", header: "Comentários", align: "end" },
        ]} /></TableRegion>
      </Disclosure>
    </Panel>
    <Grid columns={{ minWidth: 400, max: 2 }} gap={6}>
      <Panel title="Mais lidos" actions={<Button label="Todos os posts" href="/admin/posts" variant="ghost" size="sm" />}>
        {activity.topPosts.length ? <VStack as="ol" gap={0}>
          {activity.topPosts.map(post => <HStack as="li" key={post.publicId} gap={4} paddingBlock={4} className="border-b border-border last:border-0">
            <VStack className="min-w-0 flex-1" gap={1}><Link href={`/posts/${post.slug}`} target="_blank">{post.title}</Link><Text type="supporting" color="secondary">{number(post.comments)} comentários</Text></VStack>
            <VStack gap={1} className="shrink-0 text-end"><Text type="label" className="tabular-nums">{number(post.views)}</Text><Text type="supporting" color="secondary">leituras</Text></VStack>
          </HStack>)}
        </VStack> : <Empty>As primeiras leituras aparecerão aqui.</Empty>}
      </Panel>
      <Panel title="Atividade recente" actions={<Button label="Comentários" href="/admin/comments" variant="ghost" size="sm" />}>
        {activity.recent.length ? <VStack as="ol" gap={0}>{recentActivity(activity.recent.slice(0, 5))}</VStack> : <Empty>Nenhuma atividade recente.</Empty>}
        {activity.recent.length > 5 && <Disclosure title="Ver mais atividades"><VStack as="ol" gap={0}>{recentActivity(activity.recent.slice(5))}</VStack></Disclosure>}
      </Panel>
    </Grid>
    <Disclosure title="Acervo e backup">
      <Facts items={[["Posts no acervo", total], ["Ações autenticadas", activity.totals.authenticated]]} />
      <form method="post" action="/api/admin/database/download"><Button type="submit" label="Baixar backup do banco" /></form>
    </Disclosure>
  </VStack>
}
