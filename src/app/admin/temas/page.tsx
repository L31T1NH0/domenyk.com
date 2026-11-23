import { loadAdminThemesPage } from "./data"
import { CollectionsList } from "../_components/Collections"
export const metadata = { title: "Temas" }
export default async function Page() {
  const { themes } = await loadAdminThemesPage()
  return <CollectionsList kind="temas" items={themes.map(item => ({ id: item._id.toString(), title: item.name, slug: item.slug, count: item.postIds.length, active: item.active }))} />
}
