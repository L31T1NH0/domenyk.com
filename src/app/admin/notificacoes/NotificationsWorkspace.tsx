"use client"

import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"
import { useManualPushComposer, type PushContentOption } from "./useManualPushComposer"
import { useAdminNotificationSettings } from "./useAdminNotificationSettings"
import { useAdminPushDevices, type AdminPushDevice } from "./useAdminPushDevices"
import { ADMIN_PUSH_TOPIC_LABELS } from "@/lib/notification-events"
import { formatSiteDate } from "@/lib/datetime"
import { Area, Button, Check, Disclosure, Empty, Facts, Feedback, HStack, Input, PageHeader, Panel, Select, Table, TableRegion, Text, VStack } from "../_components/ui"

type Campaign = { id: string; title: string; source: string; topic: string; sent: number; failed: number; date: string }
type Props = {
  content: PushContentOption[]; devices: AdminPushDevice[];
  counts: { devices: number; posts: number; notes: number; adminDevices: number };
  campaigns: Campaign[]; initialPushSiteVisits: boolean; initialStoreSiteVisits: boolean; webhookConfigured: boolean;
}

function ManualComposer({ content }: { content: PushContentOption[] }) {
  const s = useManualPushComposer({ content })
  if (!content.length) return <Empty>Publique um post ou uma nota para enviar uma notificação aos leitores.</Empty>
  return <VStack gap={4}>
    <Select label="Conteúdo para compartilhar" value={s.selectedValue} onChange={s.select} hasSearch width="100%" options={content.map(item => ({ value: `${item.type}:${item.id}`, label: item.title, description: item.type === "post" ? "Post" : "Nota" }))} />
    <Input label="Título da notificação" value={s.title} onChange={s.changeTitle} maxLength={120} />
    <Area label="Mensagem" value={s.message} onChange={s.changeMessage} maxLength={240} />
    <Disclosure title="Prévia da notificação"><VStack gap={2} padding={4} className="bg-muted rounded-lg"><Text weight="semibold">{s.title}</Text><Text>{s.message}</Text><Text type="supporting">domenyk.com{s.selected?.href}</Text></VStack></Disclosure>
    <Feedback error={s.error} message={s.result} />
    {s.confirming ? <VStack gap={3}><Text>Enviar aos leitores inscritos em {s.selected?.type === "note" ? "notas" : "posts"}?</Text><HStack gap={2} wrap="wrap"><Button label="Voltar" isDisabled={s.sending} onClick={() => s.setConfirming(false)} /><Button label="Confirmar envio" variant="primary" isLoading={s.sending} onClick={() => void s.send()} /></HStack></VStack>
      : <Button label="Revisar envio" variant="primary" onClick={s.review} isDisabled={!s.selected || !s.title.trim() || !s.message.trim()} />}
  </VStack>
}

function VisitSettings(props: Parameters<typeof useAdminNotificationSettings>[0]) {
  const s = useAdminNotificationSettings(props)
  return <VStack gap={4}>
    <Check label="Guardar visitas na central de notificações" value={s.storeSiteVisits} onChange={value => void s.save(s.pushSiteVisits, value)} isDisabled={s.saving} />
    <Check label="Enviar visitas por push" value={s.pushSiteVisits} onChange={value => void s.save(value, s.storeSiteVisits)} isDisabled={s.saving} />
    <Text type="supporting">{s.visitStatus}{s.deduplicationStatus}</Text>
    <Feedback message={s.message} />
    <Text type="supporting">{s.webhookConfigured ? "Avisos de novas contas configurados." : "Avisos de novas contas aguardam configuração."}</Text>
  </VStack>
}

function AdminDevices({ devices }: { devices: AdminPushDevice[] }) {
  const s = useAdminPushDevices({ devices })
  return <VStack gap={4}>
    {devices.map(device => <VStack key={device.id} gap={2} paddingBlock={2}><HStack hAlign="between" wrap="wrap" gap={2}>
      <Text weight="medium">{device.label}</Text><Button label="Revogar alertas" isDisabled={s.busy !== null} size="sm" onClick={() => void s.revoke({ id: device.id }, device.id)} />
    </HStack><Text type="supporting">Atualizado em {formatSiteDate(device.updatedAt, { dateStyle: "short" })}{device.lastSuccessAt ? `; último envio em ${formatSiteDate(device.lastSuccessAt, { dateStyle: "short" })}` : ""}</Text><Text type="supporting">{device.topics.map(topic => ADMIN_PUSH_TOPIC_LABELS[topic]).join(", ")}</Text></VStack>)}
    {!devices.length && <Empty>Nenhum dispositivo recebe alertas privados.</Empty>}
    {devices.length > 1 && <Button label="Revogar alertas de todos" variant="ghost" isDisabled={s.busy !== null} onClick={() => void s.revoke({ all: true }, "all")} />}
    <Feedback message={s.message} />
  </VStack>
}

export function NotificationsWorkspace(props: Props) {
  return <VStack gap={8}>
    <PageHeader title="Notificações" description="Compartilhe uma leitura e escolha o que merece sua atenção." />
    <Panel title="Compartilhar uma publicação"><ManualComposer content={props.content} /></Panel>
    <Disclosure title="Preferências deste dispositivo"><PushSubscriptionManager showAdminEvents /></Disclosure>
    <Disclosure title="Visitas e novas contas"><VisitSettings {...props} /></Disclosure>
    <Disclosure title="Dispositivos administrativos"><AdminDevices devices={props.devices} /></Disclosure>
    <Disclosure title="Inscrições e envios">
      <Facts items={[["Dispositivos", props.counts.devices], ["Inscritos em posts", props.counts.posts], ["Inscritos em notas", props.counts.notes], ["Dispositivos administrativos", props.counts.adminDevices]]} />
      <TableRegion label="Envios recentes"><Table data={props.campaigns} idKey="id" columns={[
        { key: "title", header: "Envio", renderCell: campaign => <VStack gap={1}><Text>{campaign.title}</Text><Text type="supporting">{campaign.source === "manual" ? "Manual" : "Automático"}, {campaign.topic === "posts" ? "posts" : "notas"}</Text></VStack> },
        { key: "sent", header: "Enviados", align: "end" }, { key: "failed", header: "Falhas", align: "end" }, { key: "date", header: "Data", renderCell: campaign => formatSiteDate(campaign.date, { dateStyle: "short", timeStyle: "short" }) },
      ]} emptyState={<Text>Nenhum envio registrado.</Text>} /></TableRegion>
    </Disclosure>
  </VStack>
}
