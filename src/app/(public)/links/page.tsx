import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import { getLinkPage, getLinks } from "@/lib/links-api"
import { LinksPageView } from "@/components/links/LinksPageView"
import "@astryxdesign/core/reset.css"
import "@astryxdesign/core/astryx.css"

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { settings } = await getLinkPage()
    return buildPageMetadata({ title: settings?.metaTitle || settings?.heading || "Links", description: settings?.metaDescription || settings?.intro || "", path: "/links" })
  } catch { return buildPageMetadata({ title: "Links", description: "", path: "/links" }) }
}
export default async function LinksPage() {
  const result = await Promise.all([getLinkPage(), getLinks()]).catch(() => null)
  if (!result) return <p role="status" className="py-8 text-sm text-neutral-500">Não foi possível carregar os links agora. Tente novamente em instantes.</p>
  return <LinksPageView data={result[0]} links={result[1]} />
}
