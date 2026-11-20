import Link from "next/link"
import { getLinkPage, getLinks, parseLinkContent, requestLinksAction } from "@/lib/links-api"
import { parseLinkPageSettings } from "@/lib/link-page"
import { AdminCommandHeader } from "../AdminCommandHeader"
import { LinksManager } from "./LinksManager"

export default async function AdminLinksPage() {
  const result = await Promise.all([
    getLinks(true), requestLinksAction<unknown>("/v1/admin/links/settings"), getLinkPage(),
    requestLinksAction<{ items: unknown[]; latest?: unknown }>("/v1/admin/links/content?limit=50"),
  ]).then(([links, rawSettings, pageData, catalog]) => {
    if (!Array.isArray(catalog.items) || catalog.items.length > 50) throw new Error("Catálogo inválido")
    return { links, settings: rawSettings === null ? null : parseLinkPageSettings(rawSettings), pageData, catalog: catalog.items.map(parseLinkContent), latest: catalog.latest ? parseLinkContent(catalog.latest) : null }
  }).catch(() => null)
  return <>
    <AdminCommandHeader title="Links" description="Configure a página, organize seus links e escolha os conteúdos em destaque." actions={<Link href="/links" target="_blank" rel="noopener noreferrer" className="admin-button-secondary">Ver página pública</Link>} />
    {result ? <LinksManager {...result} /> : <p role="alert" className="admin-form-error">Não foi possível carregar a página. Confira a conexão e se a API Go está atualizada com as configurações de links.</p>}
  </>
}
