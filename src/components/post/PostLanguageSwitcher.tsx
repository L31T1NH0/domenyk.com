import {
  POST_LOCALE_DETAILS,
  type PostLocale,
} from "@/lib/post-locales"

type LanguageOption = {
  locale: PostLocale
  href: string
}

export function PostLanguageSwitcher({
  currentLocale,
  options,
}: {
  currentLocale: PostLocale
  options: LanguageOption[]
}) {
  if (options.length < 2) return null

  return (
    <nav aria-label="Idiomas disponíveis" className="mt-4 flex items-center gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">Idioma</span>
      <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
        {options.map(({ locale, href }) => {
          const details = POST_LOCALE_DETAILS[locale]
          const current = locale === currentLocale
          return current ? (
            <span
              key={locale}
              aria-current="page"
              title={details.nativeLabel}
              className="bg-zinc-900 px-2.5 py-1.5 font-semibold text-white dark:bg-white dark:text-zinc-950"
            >
              {details.shortLabel}
            </span>
          ) : (
            <a
              key={locale}
              href={href}
              hrefLang={details.htmlLang}
              lang={details.htmlLang}
              title={details.nativeLabel}
              className="px-2.5 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {details.shortLabel}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
