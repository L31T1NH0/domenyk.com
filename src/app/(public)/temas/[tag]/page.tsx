import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Header } from "@/components/Header"
import { getPostsByTag } from "@/lib/db/posts"
import { absoluteUrl, buildPageMetadata, jsonLd, siteConfig } from "@/lib/seo"

type Props = { params: Promise<{ tag: string }> }

function topicPath(tag: string) {
  return `/temas/${encodeURIComponent(tag)}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  if (!tag || tag.length > 120) return {}
  return buildPageMetadata({
    title: tag,
    description: `Textos de Domenyk sobre ${tag}.`,
    path: topicPath(tag),
  })
}

export default async function TopicPage({ params }: Props) {
  const { tag } = await params
  if (!tag || tag.length > 120) notFound()
  const posts = await getPostsByTag(tag)
  if (posts.length === 0) notFound()
  const url = absoluteUrl(topicPath(tag))

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "CollectionPage",
                "@id": `${url}#collection`,
                url,
                name: tag,
                description: `Textos de Domenyk sobre ${tag}.`,
                inLanguage: "pt-BR",
                publisher: { "@id": `${siteConfig.url}/#person` },
                mainEntity: {
                  "@type": "ItemList",
                  itemListElement: posts.map((post, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    url: absoluteUrl(`/posts/${encodeURIComponent(post.slug)}`),
                    name: post.title,
                  })),
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
                  { "@type": "ListItem", position: 2, name: "Temas" },
                  { "@type": "ListItem", position: 3, name: tag, item: url },
                ],
              },
            ],
          }),
        }}
      />
      <section className="flex flex-col">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">{tag}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-zinc-400">{posts.length} {posts.length === 1 ? "texto" : "textos"}</p>
        <ol className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-white/10 dark:border-white/10">
          {posts.map((post) => (
            <li key={post.publicId} className="py-4">
              <article>
                <h2 className="text-base font-semibold leading-snug text-neutral-950 dark:text-[#f1f1f1]">
                  <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300">
                    {post.title}
                  </Link>
                </h2>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-zinc-400">
                  {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{format(post.publishedAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</time>}
                  <span>{post.readingTimeMinutes} min</span>
                </div>
                {(post.excerpt || post.subtitle) && <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-zinc-300">{post.excerpt ?? post.subtitle}</p>}
              </article>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
