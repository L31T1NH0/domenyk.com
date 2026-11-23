import { loadEditThemePage } from "./data"
import { ThemeComposer } from "../../_components/Collections"
export const metadata = { title: "Editar tema" }
export default async function Page(props: Parameters<typeof loadEditThemePage>[0]) {
  const data = await loadEditThemePage(props)
  return <ThemeComposer {...data} />
}
