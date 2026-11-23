import { loadWritingPage } from "./data"
import { WritingWorkspace } from "./WritingWorkspace"
export const metadata = { title: "Em escrita" }
export default async function WritingPage() {
  const { entries } = await loadWritingPage()
  return <WritingWorkspace initialEntries={entries} />
}
