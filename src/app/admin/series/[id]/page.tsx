import { loadEditSeriesPage } from "./data"
import { SeriesComposer } from "../../_components/Collections"
export const metadata = { title: "Editar série" }
export default async function Page(props: Parameters<typeof loadEditSeriesPage>[0]) {
  const data = await loadEditSeriesPage(props)
  return <SeriesComposer {...data} />
}
