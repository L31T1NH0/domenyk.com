import { getWritingEntries } from "@/lib/db/writing-progress"
import { AdminCommandHeader } from "../AdminCommandHeader"
import { WritingManager } from "./WritingManager"

export default async function WritingPage() {
  const entries = await getWritingEntries()
  return <>
    <AdminCommandHeader title="O que estou escrevendo" description="Atualize manualmente os títulos e o progresso que aparecem na home." />
    <WritingManager initialEntries={entries} />
  </>
}
