import { loadAdminPushPage } from "./data"
import { NotificationsWorkspace } from "./NotificationsWorkspace"
export const metadata = { title: "Notificações" }
export default async function AdminPushPage() {
  const data = await loadAdminPushPage()
  return <NotificationsWorkspace content={data.content} devices={data.devices} counts={data.counts}
    initialPushSiteVisits={data.initialPushSiteVisits} initialStoreSiteVisits={data.initialStoreSiteVisits} webhookConfigured={data.webhookConfigured}
    campaigns={data.campaigns.map(campaign => ({ id: campaign._id.toString(), title: campaign.title, source: campaign.source, topic: campaign.topic, sent: campaign.sentCount, failed: campaign.failedCount, date: campaign.createdAt.toISOString() }))} />
}
