import Link from "next/link"

type DetailTheme = { name: string; slug: string }
type DetailSource = { label?: string; url: string }

export function PostDescriptionDisclosure({
  subtitle,
  excerpt,
  seoTitle,
  seoDescription,
  tags,
  themes,
  sources,
  publishedLabel,
  updatedLabel,
  labels,
  showLabel,
  hideLabel,
}: {
  subtitle?: string
  excerpt?: string
  seoTitle?: string
  seoDescription?: string
  tags: string[]
  themes: DetailTheme[]
  sources: DetailSource[]
  publishedLabel?: string
  updatedLabel: string
  labels: {
    subtitle: string
    excerpt: string
    seoTitle: string
    seoDescription: string
    themes: string
    tags: string
    sources: string
    dates: string
    published: string
    updated: string
  }
  showLabel: string
  hideLabel: string
}) {
  const rows = [
    [labels.subtitle, subtitle],
    [labels.excerpt, excerpt],
    [labels.seoTitle, seoTitle],
    [labels.seoDescription, seoDescription],
  ].filter((row): row is [string, string] => Boolean(row[1]?.trim()))

  return (
    <details className="group mb-5">
      <summary className="inline-flex min-h-7 cursor-pointer list-none items-center rounded-sm text-xs text-zinc-500 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-zinc-400 dark:hover:text-white dark:focus-visible:ring-neutral-300 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{showLabel}</span>
        <span className="hidden group-open:inline">{hideLabel}</span>
      </summary>
      <div className="mt-3 max-w-[70ch] space-y-4 border-l border-zinc-200 pl-4 text-sm dark:border-zinc-700">
        {rows.map(([label, value]) => (
          <div key={label}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{label}</h2>
            <p className="mt-1 leading-relaxed text-neutral-700 dark:text-zinc-300">{value}</p>
          </div>
        ))}
        {themes.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{labels.themes}</h2>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {themes.map((theme) => <Link key={theme.slug} href={`/temas/${encodeURIComponent(theme.slug)}`} className="text-neutral-700 underline decoration-zinc-300 underline-offset-4 hover:text-neutral-950 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-white">{theme.name}</Link>)}
            </p>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{labels.tags}</h2>
            <p className="mt-1 leading-relaxed text-neutral-700 dark:text-zinc-300">{tags.map((tag) => `#${tag}`).join(" · ")}</p>
          </div>
        )}
        {sources.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{labels.sources}</h2>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {sources.map((source) => <li key={source.url}><a href={source.url} rel="noopener noreferrer" className="break-words text-neutral-700 underline decoration-zinc-300 underline-offset-4 hover:text-neutral-950 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-white">{source.label || source.url}</a></li>)}
            </ol>
          </div>
        )}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{labels.dates}</h2>
          <p className="mt-1 leading-relaxed text-neutral-700 dark:text-zinc-300">
            {publishedLabel ? `${labels.published} ${publishedLabel}. ` : ""}{labels.updated} {updatedLabel}.
          </p>
        </div>
      </div>
    </details>
  )
}
