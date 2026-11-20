import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import { getLinkPage, getLinks } from "@/lib/links-api"
import { LinksPageView } from "@/components/links/LinksPageView"

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { settings } = await getLinkPage()
    return buildPageMetadata({ title: settings?.metaTitle || settings?.heading || "Links", description: settings?.metaDescription || settings?.intro || "", path: "/links" })
  } catch { return buildPageMetadata({ title: "Links", description: "", path: "/links" }) }
}
export default async function LinksPage() {
  const result = await Promise.all([getLinkPage(), getLinks()]).catch(() => null)
  if (!result) return <p role="status" className="py-8 text-sm text-neutral-500">Não foi possível carregar os links agora. Tente novamente em instantes.</p>
  return <>
    <aside role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3 text-red-800 dark:border-red-400/20 dark:bg-red-400/5 dark:text-red-300">
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500 dark:bg-red-400" />
      <p className="text-xs leading-relaxed"><strong className="font-semibold">Página em desenvolvimento.</strong>{" "}Todos os links já podem ser acessados. O visual ainda está sendo ajustado e não representa a versão final.</p>
    </aside>
    <LinksPageView data={result[0]} links={result[1]} />
  </>
}
