import { loadAdminSeriesPage } from "./data"
import { CollectionsList } from "../_components/Collections"
export const metadata = { title: "Séries" }
export default async function Page() {
  const { series } = await loadAdminSeriesPage()
  return <CollectionsList kind="series" items={series.map(item => ({ id: item._id.toString(), title: item.title, slug: item.slug, count: item.postIds.length, active: item.published }))} />
}
