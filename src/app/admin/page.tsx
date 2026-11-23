import { loadAdminDashboard } from "./data"
import { Overview } from "./_components/Overview"

export const metadata = { title: "Visão geral" }

export default async function AdminDashboard() {
  return <Overview {...await loadAdminDashboard()} />
}
