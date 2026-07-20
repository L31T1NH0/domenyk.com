import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { Header } from "@/components/Header"
import { getThemeBySlug, getThemePosts } from "@/lib/db/themes"
import { absoluteUrl, buildPageMetadata, jsonLd, siteConfig } from "@/lib/seo"
import { formatSiteDate } from "@/lib/datetime"

type Props = { params: Promise<{ tag: string }> }

const getCachedTheme = cache((slug: string) => getThemeBySlug(slug, { activeOnly: true }))

function slugFromParam(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return ""
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = slugFromParam((await params).tag)
  if (!slug || slug.length > 100) return {}
  const theme = await getCachedTheme(slug)
  if (!theme) return {}
  return buildPageMetadata({
    title: theme.name,
    description: theme.description,
    path: `/temas/${theme.slug}`,
  })
}

export default async function ThemePage({ params }: Props) {
  const slug = slugFromParam((await params).tag)
  if (!slug || slug.length > 100) notFound()
  const theme = await getCachedTheme(slug)
  if (!theme) notFound()
  const posts = await getThemePosts(theme)
  const url = absoluteUrl(`/temas/${theme.slug}`)

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
                name: theme.name,
                description: theme.description,
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
                  { "@type": "ListItem", position: 2, name: theme.name, item: url },
                ],
              },
            ],
          }),
        }}
      />
      <section className="flex flex-col">
        <p className="mb-2 text-xs font-medium uppercase tracking-[.14em] text-neutral-500 dark:text-zinc-500">Tema</p>
        <h1 className="text-balance text-xl font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">{theme.name}</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-neutral-600 dark:text-zinc-400">{theme.description}</p>
        <p className="mt-3 text-xs text-neutral-500 dark:text-zinc-500">{posts.length} {posts.length === 1 ? "texto selecionado" : "textos selecionados"}</p>
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
                  {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatSiteDate(post.publishedAt, { dateStyle: "long" })}</time>}
                  <span>{post.readingTimeMinutes} min</span>
                </div>
                {(post.excerpt || post.subtitle) && <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-zinc-300">{post.excerpt ?? post.subtitle}</p>}
              </article>
            </li>
          ))}
          {posts.length === 0 && <li className="py-10 text-sm text-neutral-500">Nenhum texto foi selecionado para este tema ainda.</li>}
        </ol>
      </section>
    </>
  )
}
