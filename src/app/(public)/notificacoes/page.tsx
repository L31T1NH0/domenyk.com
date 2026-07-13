import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { NotificationList } from "@/components/notifications/NotificationList"
import { isAdmin } from "@/lib/auth"
export const metadata: Metadata = { title: "Notificações", robots: { index: false, follow: false } }
export default async function NotificationsPage() {
  if (!(await isAdmin())) notFound()
  return <NotificationList />
}
