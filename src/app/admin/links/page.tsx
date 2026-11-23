import { loadAdminLinksPage } from "./data"
import { LinksWorkspace } from "./LinksWorkspace"
import { Feedback, PageHeader, VStack } from "../_components/ui"
export const metadata = { title: "Links" }
export default async function AdminLinksPage() {
  const { result } = await loadAdminLinksPage()
  if (!result) return <VStack gap={6}><PageHeader title="Links" /><Feedback error="Não foi possível carregar seus links. Recarregue a página para tentar novamente." /></VStack>
  return <LinksWorkspace {...result} />
}
