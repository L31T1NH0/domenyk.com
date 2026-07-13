import type { Metadata } from "next"
import { BackHome } from "@/components/BackHome"
import { Correspondence } from "@/components/messages/Correspondence"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Fale comigo",
  description: "Envie uma ideia, sugestão ou melhoria diretamente para Domenyk.",
  path: "/fale-comigo",
})
export default function ContactPage() {
  return (
    <>
      <h1 className="sr-only">Fale comigo</h1>
      <Correspondence />
      <div id="contact-content-boundary" />
      <BackHome boundaryId="contact-content-boundary" label="Voltar para a página inicial" />
    </>
  )
}
