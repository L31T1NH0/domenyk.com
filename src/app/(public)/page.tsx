import type { Metadata } from "next"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { isAdmin } from "@/lib/auth"
import { Header } from "@/components/Header"
import { HomeTimeline } from "./HomeTimeline"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata()

export default async function HomePage() {
  const admin = await isAdmin()
  const [{ posts, total }, { notes, nextCursor }] = await Promise.all([
    getPosts({ limit: 20, excludeHiddenFromTimeline: true }),
    getNotes({ limit: 20 }),
  ])

  return (
    <>
      <Header />
      <section className="flex flex-col items-center gap-1 pb-4 text-center">
        <p className="text-lg text-zinc-200">Dou minhas opiniões aqui</p>
      </section>

      <HomeTimeline
        posts={posts.map(serializePostSummary)}
        totalPosts={total}
        initialNotes={notes.map(serializeNote)}
        initialCursor={nextCursor}
        isAdmin={admin}
      />
    </>
  )
}
