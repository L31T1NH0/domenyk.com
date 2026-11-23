"use client"

import type { loadAdminDashboard } from "../data"
import { Button, Disclosure, Empty, Facts, Grid, HStack, Link, PageHeader, Panel, Table, TableRegion, Text, VStack } from "./ui"

type Props = Awaited<ReturnType<typeof loadAdminDashboard>>
const number = (value: number) => value.toLocaleString("pt-BR")

export function Overview({ total, activity }: Props) {
  const max = Math.max(1, ...activity.days.map(day => day.views))
  const points = activity.days.map((day, i) => `${i / Math.max(1, activity.days.length - 1) * 640},${140 - day.views / max * 120}`).join(" ")
  return <VStack gap={8}>
    <PageHeader title="Seu trabalho, em movimento." description="Um olhar sobre as leituras e conversas dos últimos 14 dias."
      actions={<Button label="Escrever post" variant="primary" href="/admin/posts/new" />} />
    <Grid columns={{ minWidth: 160, max: 3 }} gap={6}>
      {[["Leituras", activity.totals.views], ["Visitantes", activity.totals.visitors], ["Comentários", activity.totals.comments]].map(([label, value]) =>
        <VStack gap={1} key={label}><Text color="secondary">{label}</Text><Text type="display-3">{number(Number(value))}</Text></VStack>)}
    </Grid>
    <Panel title="Ritmo de leitura">
      <figure>
        <svg viewBox="0 0 640 160" className="w-full" role="img" aria-labelledby="reading-chart-title">
          <title id="reading-chart-title">Visualizações diárias nos últimos 14 dias. Os valores estão disponíveis em Dados do período.</title>
          <path d="M0 140H640" fill="none" stroke="var(--color-border)" />
          <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        <figcaption><HStack hAlign="between"><Text type="supporting">Há 14 dias</Text><Text type="supporting">Hoje</Text></HStack></figcaption>
      </figure>
      <Disclosure title="Dados do período">
        <TableRegion label="Leituras e comentários por dia"><Table data={activity.days} idKey="date" columns={[
          { key: "date", header: "Dia" }, { key: "views", header: "Leituras", align: "end" }, { key: "comments", header: "Comentários", align: "end" },
        ]} /></TableRegion>
      </Disclosure>
    </Panel>
    <Panel title="Mais lidos">
      {activity.topPosts.length ? <VStack as="ol" gap={0}>
        {activity.topPosts.map(post => <HStack as="li" key={post.publicId} hAlign="between" gap={4} paddingBlock={3}>
          <Link href={`/posts/${post.slug}`} target="_blank">{post.title}</Link>
          <Text type="supporting">{number(post.views)} leituras</Text>
        </HStack>)}
      </VStack> : <Empty>As primeiras leituras aparecerão aqui.</Empty>}
    </Panel>
    <Disclosure title="Atividade recente">
      {activity.recent.map(event => <VStack key={event.id} gap={1} paddingBlock={2}>
        <Text>{event.type === "post_view" ? "Leitura" : "Comentário"}: {event.postTitle ?? "Conteúdo removido"}</Text>
        <Text type="supporting">{event.isAuthenticated ? event.userName ?? "Pessoa identificada" : "Visitante anônimo"} em {new Date(event.occurredAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</Text>
      </VStack>)}
      {!activity.recent.length && <Empty>Nenhuma atividade recente.</Empty>}
    </Disclosure>
    <Disclosure title="Acervo e backup">
      <Facts items={[["Posts no acervo", total], ["Ações autenticadas", activity.totals.authenticated]]} />
      <form method="post" action="/api/admin/database/download"><Button type="submit" label="Baixar backup do banco" /></form>
    </Disclosure>
  </VStack>
}
