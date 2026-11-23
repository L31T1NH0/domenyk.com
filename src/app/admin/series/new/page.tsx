import { loadNewSeriesPage } from "./data"
import { SeriesComposer } from "../../_components/Collections"
export const metadata = { title: "Criar série" }
export default async function Page() {
  const data = await loadNewSeriesPage()
  return <SeriesComposer {...data} />
}
