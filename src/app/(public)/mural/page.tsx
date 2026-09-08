import Link from "next/link"
import { isAdmin } from "@/lib/auth"
import { PersonalTimeline } from "@/components/timeline/PersonalTimeline"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({ title: "Mural", description: "Publicações no mural de Domenyk.", path: "/mural" })

export default async function MuralPage() {
  const admin = await isAdmin()
  return (
    <section className="py-4">
      <Link href="/" className="personal-timeline-action">Voltar ao início</Link>
      <h1 className="mb-6 mt-6 text-2xl font-medium">Mural</h1>
      <PersonalTimeline isAdmin={admin} />
    </section>
  )
}
