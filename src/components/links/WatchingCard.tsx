"use client"

import { useEffect, useState } from "react"
import { Stack } from "@astryxdesign/core/Stack"
import { Grid } from "@astryxdesign/core/Grid"
import { Text } from "@astryxdesign/core/Text"
import { MediaTheme, Theme } from "@astryxdesign/core/theme"
import { FilmIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline"
import { useThemeSwitcher } from "@/components/ThemeSwitcher"
import { themes, defaultThemeSlug } from "@/astryx-themes"
import { currentWatching, parseWatchingStatus, type WatchingStatus } from "@/lib/watching"

export function WatchingCard() {
  const { darkMode } = useThemeSwitcher()
  const [status, setStatus] = useState<{ data: WatchingStatus; now: number } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let expiry: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch("/api/links/watching", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
          if (!response.ok) throw new Error("Reprodução indisponível")
          const data = parseWatchingStatus(await response.json())
          if (active) {
            const now = Date.now()
            clearTimeout(expiry)
            setStatus({ data, now })
            if (data.current) expiry = setTimeout(() => { if (active) setStatus(null) }, Math.max(0, 45_000 - (now - Date.parse(data.current.updatedAt))))
          }
        }
      } catch {
        if (active) setStatus(null)
      } finally {
        if (active) timer = setTimeout(refresh, 15_000)
      }
    }
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer); clearTimeout(expiry) }
  }, [])

  const video = status ? currentWatching(status.data, status.now) : null
  if (!video) return null

  return <Theme theme={themes[defaultThemeSlug]} mode={darkMode ? "dark" : "light"}><a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Assistindo agora: ${video.title}${video.episode ? `, ${video.episode}` : ""}. Abrir na Netflix`} className="relative isolate mt-6 block overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 text-inherit no-underline hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/15 dark:hover:border-white/40">
    <MediaTheme mode="dark">
      <figure className="pointer-events-none absolute inset-y-0 left-0 m-0 w-20 overflow-clip forced-colors:hidden">
        <Stack vAlign="center" hAlign="center" className="absolute inset-y-0 left-0 w-12">
          <FilmIcon aria-hidden="true" className="size-6 text-neutral-500" />
        </Stack>
        {video.cover && <>
          <img key={`${video.cover}-fade`} src={video.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover opacity-50 blur-md" onError={event => { event.currentTarget.hidden = true }} />
          <img key={video.cover} src={video.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-y-0 left-0 h-full w-auto max-w-12 object-contain" onError={event => { event.currentTarget.hidden = true }} />
        </>}
        <Stack className="absolute inset-0 bg-linear-to-r/oklab from-transparent from-40% via-neutral-950/95 via-80% to-neutral-950" />
      </figure>
      <Stack as="article" direction="horizontal" gap={2} padding={2} vAlign="center" className="relative">
        <Stack className="size-12 shrink-0" />
        <Stack as="header" gap={0} vAlign="between" className="h-12 min-w-0 flex-1 leading-3.5">
          <Text as="p" type="inherit" size="xsm" color="secondary" maxLines={1}>Assistindo agora · Netflix</Text>
          <Grid columns={1} gap={0} align="center">
            <Text as="h2" type="inherit" size="sm" weight="semibold" maxLines={1}>{video.title}</Text>
            {video.episode && <Text as="p" type="inherit" size="xsm" color="secondary" maxLines={1}>{video.episode}</Text>}
          </Grid>
        </Stack>
        <ArrowUpRightIcon aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
      </Stack>
    </MediaTheme>
  </a></Theme>
}
