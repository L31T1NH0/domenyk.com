import { loadNewThemePage } from "./data"
import { ThemeComposer } from "../../_components/Collections"
export const metadata = { title: "Criar tema" }
export default async function Page() {
  const data = await loadNewThemePage()
  return <ThemeComposer {...data} />
}
