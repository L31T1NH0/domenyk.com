import { loadAdminMediaPage } from "./data"
import { MediaWorkspace } from "./MediaWorkspace"
export const metadata = { title: "Mídia" }
export default async function AdminMediaPage() {
  const { initialMedia } = await loadAdminMediaPage()
  return <MediaWorkspace initialMedia={initialMedia} />
}
